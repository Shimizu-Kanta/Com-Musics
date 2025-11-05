'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server' // ← 既存のサーバー用ヘルパを想定（App Router から呼ぶ）

type LiveActionIssue = { field: string; code: string; message: string }
type LiveActionState = { error?: string; success?: string; errors?: LiveActionIssue[] } | null

// 形式チェック
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SPOTIFY_ID_RE = /^[0-9A-Za-z]{22}$/

const FormSchema = z.object({
  name: z.string().min(1, 'ライブ名は必須です'),
  venue: z.string().min(1, '会場は必須です'),
  date: z.string().regex(DATE_RE, '日付は YYYY-MM-DD 形式で入力してください'),
  description: z.string().optional().default(''),
  artistDbIds: z.array(z.string().regex(UUID_RE)).optional().default([]),
  artistSpotifyIds: z.array(z.string().regex(SPOTIFY_ID_RE)).optional().default([]),
  // 補助（spotifyIds と同じ順序で送る）
  artistNames: z.array(z.string()).optional().default([]),
  artistImages: z.array(z.string()).optional().default([]),
}).refine(
  (v) => (v.artistDbIds?.length ?? 0) + (v.artistSpotifyIds?.length ?? 0) > 0,
  { path: ['artistDbIds'], message: 'アーティストを1組以上選択してください' }
)

export async function createLive(
  _prev: LiveActionState,
  formData: FormData
): Promise<LiveActionState> {
  const supabase = createClient()

  // 認証
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth?.user?.id) {
    return { error: 'ライブを登録するにはログインが必要です。' }
  }
  const profiles_id = auth.user.id

  // 受信 & 検証
  const raw = {
    name: String(formData.get('name') ?? ''),
    venue: String(formData.get('venue') ?? ''),
    date: String(formData.get('date') ?? ''),
    description: formData.get('description') ? String(formData.get('description')) : '',
    artistDbIds: formData.getAll('artistDbIds[]').map(String),
    artistSpotifyIds: formData.getAll('artistSpotifyIds[]').map(String),
    artistNames: formData.getAll('artistNames[]').map(String),
    artistImages: formData.getAll('artistImages[]').map(String),
  }
  const parsed = FormSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: LiveActionIssue[] = parsed.error.issues.map((i) => ({
      field: i.path.join('.') || '(form)',
      code: i.code,
      message: i.message,
    }))
    return { error: '入力値が不正です', errors }
  }

  const { name, venue, date, description, artistDbIds, artistSpotifyIds, artistNames, artistImages } =
    parsed.data

  // 1) 既存DBのUUIDはそのまま採用
  const existingIds = [...new Set(artistDbIds)]

  // 2) Spotify経由の新規は upsert して UUID を得る（順序を合わせる）
  const newIds: string[] = []
  for (let i = 0; i < artistSpotifyIds.length; i++) {
    const sid = artistSpotifyIds[i]
    const nm = artistNames[i] ?? null
    const img = artistImages[i] ?? null

    // 既存チェック（spotify_id 一意）
    const { data: found, error: findErr } = await supabase
      .from('artists_v2')
      .select('id')
      .eq('spotify_id', sid)
      .maybeSingle()
    if (findErr) return { error: findErr.message ?? 'アーティスト照会に失敗しました。' }

    if (found?.id) {
      newIds.push(found.id)
    } else {
      // upsert（spotify_id UNIQUE を想定）
      const { data: inserted, error: upErr } = await supabase
        .from('artists_v2')
        .upsert({ spotify_id: sid, name: nm ?? sid, image_url: img }, { onConflict: 'spotify_id' })
        .select('id')
        .single()
      if (upErr || !inserted?.id) {
        return { error: upErr?.message ?? 'アーティストの作成に失敗しました。' }
      }
      newIds.push(inserted.id)
    }
  }

  const finalArtistIds = Array.from(new Set([...existingIds, ...newIds]))
  if (finalArtistIds.length === 0) {
    return {
      error: '入力値が不正です',
      errors: [{ field: 'artistDbIds', code: 'too_small', message: 'アーティストを1組以上選択してください' }],
    }
  }

  // 3) lives_v2 を作成
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

  if (liveErr || !liveRow?.id) {
    return { error: liveErr?.message ?? 'ライブの作成に失敗しました。' }
  }
  const liveId: number = liveRow.id as number

  // 4) live_artists に紐付けをまとめて登録
  const links = finalArtistIds.map((artist_id) => ({ live_id: liveId, artist_id }))
  const { error: linkErr } = await supabase.from('live_artists').insert(links)
  if (linkErr) {
    // ロールバック
    await supabase.from('lives_v2').delete().eq('id', liveId)
    return { error: linkErr.message ?? 'ライブ-アーティスト関連の作成に失敗しました。' }
  }

  revalidatePath('/live')
  redirect('/live')
}
