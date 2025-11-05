'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

/** 返り値（useActionState想定） */
type LiveActionIssue = { field: string; code: string; message: string }
type LiveActionState = { error?: string; success?: string; errors?: LiveActionIssue[] } | null

/** 環境変数（Server側で保持） */
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? ''
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? ''

/** バリデーション */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SPOTIFY_ID_RE = /^[0-9A-Za-z]{22}$/ // Spotifyのartist id

const LiveFormSchema = z
  .object({
    name: z.string().min(1, 'ライブ名は必須です'),
    venue: z.string().min(1, '会場は必須です'),
    date: z.string().regex(DATE_RE, '日付は YYYY-MM-DD 形式で入力してください'),
    description: z.string().optional().default(''),
    artistDbIds: z.array(z.string().regex(UUID_RE)).optional().default([]),
    artistSpotifyIds: z.array(z.string().regex(SPOTIFY_ID_RE)).optional().default([]),
  })
  .refine(
    (v) => (v.artistDbIds?.length ?? 0) + (v.artistSpotifyIds?.length ?? 0) > 0,
    { path: ['artistDbIds'], message: 'アーティストを1組以上選択してください' }
  )

/** Spotify API 型 */
type SpotifyTokenResponse = { access_token: string }
type SpotifyArtist = {
  id: string
  name: string
  images?: { url: string; height?: number | null; width?: number | null }[]
}

/** Spotify: Client Credentials トークン */
async function getSpotifyToken(): Promise<string> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify のクレデンシャルが設定されていません。')
  }
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) throw new Error(`Spotify token 取得に失敗（${res.status}）`)
  const json = (await res.json()) as SpotifyTokenResponse
  return json.access_token
}

/** Spotify: /v1/artists/{id} で正規名・画像を取得 */
async function fetchSpotifyArtistById(id: string, token: string): Promise<SpotifyArtist | null> {
  const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const json = (await res.json()) as SpotifyArtist
  return json
}

/** artists_v2 を spotify_id で upsert し、UUID を返す */
async function ensureArtistIdBySpotifyId(spotifyId: string, token: string): Promise<string> {
  const supabase = createClient()

  // 既存（spotify_id）を先に探す
  {
    const { data: bySid, error } = await supabase
      .from('artists_v2')
      .select('id')
      .eq('spotify_id', spotifyId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (bySid?.id) return bySid.id
  }

  // Spotifyから正規情報を取得
  const artist = await fetchSpotifyArtistById(spotifyId, token)
  if (!artist) throw new Error(`Spotify artist が見つかりません: ${spotifyId}`)

  const bestImage =
    (artist.images ?? []).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null

  // upsert（spotify_id UNIQUE を想定）
  const { data, error: upsertErr } = await supabase
    .from('artists_v2')
    .upsert({ spotify_id: artist.id, name: artist.name, image_url: bestImage }, { onConflict: 'spotify_id' })
    .select('id')
    .single()

  if (upsertErr || !data?.id) {
    throw new Error(upsertErr?.message ?? 'artists_v2 upsert に失敗しました')
  }
  return data.id
}

/** 本体：ライブ作成（検索なし・IDだけで安全に確定） */
export async function createLiveV2(
  _prev: LiveActionState,
  formData: FormData
): Promise<LiveActionState> {
  const supabase = createClient()

  // 認証
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth?.user?.id) return { error: 'ライブを登録するにはログインが必要です。' }
  const profiles_id = auth.user.id

  // 入力
  const raw = {
    name: String(formData.get('name') ?? ''),
    venue: String(formData.get('venue') ?? ''),
    date: String(formData.get('date') ?? ''),
    description: formData.get('description') ? String(formData.get('description')) : '',
    artistDbIds: formData.getAll('artistDbIds[]').map(String),
    artistSpotifyIds: formData.getAll('artistSpotifyIds[]').map(String),
  }
  const parsed = LiveFormSchema.safeParse(raw)
  if (!parsed.success) {
    const issues: LiveActionIssue[] = parsed.error.issues.map((i) => ({
      field: i.path.join('.') || '(form)',
      code: i.code,
      message: i.message,
    }))
    return { error: '入力値が不正です', errors: issues }
  }

  const { name, venue, date, description, artistDbIds, artistSpotifyIds } = parsed.data

  // 既存UUIDの存在確認
  let validDbIds: string[] = []
  if (artistDbIds.length) {
    const { data: rows, error } = await supabase
      .from('artists_v2')
      .select('id')
      .in('id', artistDbIds)
    if (error) return { error: error.message ?? 'アーティスト照会に失敗しました。' }
    const ok = new Set(rows?.map((r) => r.id) ?? [])
    const missing = artistDbIds.filter((id) => !ok.has(id))
    if (missing.length) {
      const issues: LiveActionIssue[] = missing.map((id) => ({
        field: 'artistDbIds',
        code: 'not_found',
        message: `存在しないアーティストIDです: ${id}`,
      }))
      return { error: '入力値が不正です', errors: issues }
    }
    validDbIds = artistDbIds
  }

  // Spotify ID から UUID を確定
  let resolvedFromSpotify: string[] = []
  if (artistSpotifyIds.length) {
    const token = await getSpotifyToken()
    const uniq = Array.from(new Set(artistSpotifyIds))
    const ids: string[] = []
    for (const sid of uniq) {
      const uuid = await ensureArtistIdBySpotifyId(sid, token)
      ids.push(uuid)
    }
    resolvedFromSpotify = ids
  }

  const finalArtistIds = Array.from(new Set([...validDbIds, ...resolvedFromSpotify]))
  if (finalArtistIds.length === 0) {
    return {
      error: '入力値が不正です',
      errors: [{ field: 'artistDbIds', code: 'too_small', message: 'アーティストを1組以上選択してください' }],
    }
  }

  // lives_v2 作成
  const { data: liveRow, error: liveErr } = await supabase
    .from('lives_v2')
    .insert({
      name,
      venue,
      live_date: date,
      description: description || null,
      profiles_id,
    })
    .select('id')
    .single()
  if (liveErr || !liveRow?.id) return { error: liveErr?.message ?? 'ライブの作成に失敗しました。' }
  const liveId: number = liveRow.id as number

  // live_artists 紐づけ
  const links = finalArtistIds.map((artist_id) => ({ live_id: liveId, artist_id }))
  const { error: linkErr } = await supabase.from('live_artists').insert(links)
  if (linkErr) {
    await supabase.from('lives_v2').delete().eq('id', liveId) // rollback
    return { error: linkErr.message ?? 'ライブ-アーティスト関連の作成に失敗しました。' }
  }

  revalidatePath('/live')
  redirect('/live')
}
