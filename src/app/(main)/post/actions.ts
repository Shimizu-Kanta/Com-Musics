'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** =========================================================
 * Tag 型（フロントと共有）
 * ======================================================= */
export type Tag =
  | { type: 'artist'; id: string; name: string; imageUrl?: string }
  | { type: 'song';   id: string; name: string; imageUrl?: string; artistName?: string }
  | { type: 'live';   id: string; name: string; venue?: string | null; liveDate?: string | null }
  | { type: 'video';  id: string; name: string; imageUrl?: string; artistName?: string }

/** =========================================================
 * ENV
 * ======================================================= */
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? ''
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? ''
const YT_API_KEY = process.env.YOUTUBE_API_KEY ?? ''

/** =========================================================
 * 共通ユーティリティ
 * ======================================================= */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}$/i
const SPOTIFY_ID_22 = /^[0-9A-Za-z]{22}$/ // artist/track

function assertEnvSpotify() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotifyクレデンシャル未設定（SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET）')
  }
}

/** =========================================================
 * Spotify helpers
 * ======================================================= */
type SpotifyTokenRes = { access_token: string }
type SpotifyArtist = { id: string; name: string; images?: { url: string; width?: number }[] }
type SpotifyTrack = {
  id: string
  name: string
  album?: { images?: { url: string; width?: number }[] }
  artists: { id: string; name: string }[]
}

async function getSpotifyToken(): Promise<string> {
  assertEnvSpotify()
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Spotify token取得失敗')
  const json = (await res.json()) as SpotifyTokenRes
  return json.access_token
}

async function fetchSpotifyArtist(id: string, token: string): Promise<SpotifyArtist | null> {
  const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as SpotifyArtist
}

async function fetchSpotifyTrack(id: string, token: string): Promise<SpotifyTrack | null> {
  const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as SpotifyTrack
}

/** Spotify ID/URL から 22桁ID を抽出 */
function extractSpotifyId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (SPOTIFY_ID_22.test(s)) return s
  try {
    const u = new URL(s)
    const parts = u.pathname.split('/').filter(Boolean) // /track/{id} /artist/{id}
    const maybe = parts[1]
    return SPOTIFY_ID_22.test(maybe ?? '') ? (maybe as string) : null
  } catch {
    return null
  }
}

/** v2: Spotify アーティストを upsert → artists_v2.id を返す */
async function ensureArtistBySpotifyId(spotifyId: string, token: string): Promise<string> {
  const supabase = createClient()

  // 既存
  {
    const { data } = await supabase
      .from('artists_v2')
      .select('id')
      .eq('spotify_id', spotifyId)
      .maybeSingle()
    if (data?.id) return data.id
  }

  // 取得 → upsert
  const art = await fetchSpotifyArtist(spotifyId, token)
  if (!art) throw new Error('Spotifyアーティスト取得失敗')

  const img =
    (art.images ?? []).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null

  const { data, error } = await supabase
    .from('artists_v2')
    .upsert(
      { spotify_id: art.id, name: art.name, image_url: img },
      { onConflict: 'spotify_id' }
    )
    .select('id')
    .single()

  if (error || !data?.id) throw new Error(error?.message ?? 'artists_v2 upsert失敗')
  return data.id
}

/** v2: Spotify トラックを upsert → songs_v2.id を返す（song_artists も同期） */
async function ensureSongBySpotifyTrackId(trackId: string, token: string): Promise<string> {
  const supabase = createClient()

  // 既存
  {
    const { data } = await supabase
      .from('songs_v2')
      .select('id')
      .eq('spotify_id', trackId)
      .maybeSingle()
    if (data?.id) return data.id
  }

  // 取得 → upsert
  const tr = await fetchSpotifyTrack(trackId, token)
  if (!tr) throw new Error('Spotifyトラック取得失敗')

  const cover =
    (tr.album?.images ?? []).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null

  const { data, error } = await supabase
    .from('songs_v2')
    .upsert(
      { spotify_id: tr.id, title: tr.name, image_url: cover },
      { onConflict: 'spotify_id' }
    )
    .select('id')
    .single()

  if (error || !data?.id) throw new Error(error?.message ?? 'songs_v2 upsert失敗')
  const songId = data.id as string

  // 曲のアーティストを song_artists に反映（最小：重複はDBの複合PK/ユニークに任せる）
  for (const a of tr.artists) {
    const aid = await ensureArtistBySpotifyId(a.id, token)
    await supabase
      .from('song_artists')
      .upsert({ song_id: songId, artist_id: aid }, { onConflict: 'song_id,artist_id' })
  }

  return songId
}

/** =========================================================
 * YouTube helpers（A案：URL/ID → videos.uuid 解決）
 * ======================================================= */
type VideoType = 'original_song' | 'cover' | 'live_performance'

/** YouTube URL/ID から 11文字の動画IDを抽出 */
function parseYouTubeVideoId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  try {
    // 生IDっぽい文字列（URLでない）
    if (/^[A-Za-z0-9_-]{10,}$/.test(s) && !s.includes('://')) return s

    const u = new URL(s)
    const host = u.hostname.replace(/^www\./, '')
    const parts = u.pathname.split('/').filter(Boolean)

    // https://www.youtube.com/watch?v=ID
    const v = u.searchParams.get('v')
    if (v) return v

    // https://youtu.be/ID
    if (host === 'youtu.be') return parts[0] ?? null

    // https://www.youtube.com/shorts/ID など
    if (
      host.endsWith('youtube.com') &&
      parts.length >= 2 &&
      ['shorts', 'live', 'embed', 'v'].includes(parts[0])
    ) {
      return parts[1]
    }
  } catch {
    // noop
  }
  return null
}

/** YouTubeのメタを取得（タイトル/カテゴリ/サムネ） */
async function fetchYouTubeMeta(yid: string): Promise<{
  title: string
  categoryId: string | null
  thumbnail: string | null
}> {
  if (!YT_API_KEY) throw new Error('YouTube APIキー未設定')
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(
    yid
  )}&key=${YT_API_KEY}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('YouTube動画情報の取得に失敗しました')
  const j = (await res.json()) as {
    items?: {
      snippet?: {
        title?: string
        categoryId?: string
        thumbnails?: {
          maxres?: { url?: string }
          standard?: { url?: string }
          high?: { url?: string }
          medium?: { url?: string }
          default?: { url?: string }
        }
      }
    }[]
  }
  const sn = j.items?.[0]?.snippet
  if (!sn?.title) throw new Error('YouTube動画情報が見つかりません')
  const thumb =
    sn.thumbnails?.maxres?.url ??
    sn.thumbnails?.standard?.url ??
    sn.thumbnails?.high?.url ??
    sn.thumbnails?.medium?.url ??
    sn.thumbnails?.default?.url ??
    null
  return {
    title: sn.title,
    categoryId: sn.categoryId ?? null,
    thumbnail: thumb,
  }
}

/**
 * URL/ID → videos.uuid を保証。
 * 既存があればそれを返し、無ければ最小の情報で videos 行を新規作成。
 * video_type は既定値で作成（必要なら呼び出し側から指定）。
 */
async function ensureVideoByYouTubeId(
  yid: string,
  videoTypeForNew: VideoType = 'original_song'
): Promise<string> {
  const supabase = createClient()

  // 既存
  {
    const { data } = await supabase
      .from('videos')
      .select('id')
      .eq('youtube_video_id', yid)
      .maybeSingle()
    if (data?.id) return data.id as string
  }

  // メタを取得して新規作成
  const meta = await fetchYouTubeMeta(yid)
  const { data, error } = await supabase
    .from('videos')
    .insert({
      title: meta.title,
      youtube_video_id: yid,
      thumbnail_url: meta.thumbnail,
      youtube_category_id: meta.categoryId,
      video_type: videoTypeForNew, // ENUM: DB側に値が存在すること
    })
    .select('id')
    .single()
  if (error || !data?.id) throw new Error(error?.message ?? '動画の作成に失敗しました')
  return data.id as string
}

/** DBに既存の動画がないか（id/youtube_video_id/URL解析）を広めに探す */
async function findVideoUuidFromAny(input: string): Promise<string | null> {
  const supabase = createClient()
  const raw = input.trim()

  // (A) id（UUID）
  {
    const { data } = await supabase
      .from('videos')
      .select('id')
      .eq('id', raw)
      .maybeSingle()
    if (data?.id) return data.id as string
  }

  // (B) youtube_video_id（11文字）
  {
    const { data } = await supabase
      .from('videos')
      .select('id')
      .eq('youtube_video_id', raw)
      .maybeSingle()
    if (data?.id) return data.id as string
  }

  // (C) URL から抽出して再チェック
  const yid = parseYouTubeVideoId(raw)
  if (yid) {
    const { data } = await supabase
      .from('videos')
      .select('id')
      .eq('youtube_video_id', yid)
      .maybeSingle()
    if (data?.id) return data.id as string
  }

  return null
}

/** =========================================================
 * 検索アクション（UI互換）
 * ======================================================= */
export async function searchMusic(q: string) {
  const token = await getSpotifyToken()
  const res = await fetch(
    `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  )
  if (!res.ok) return []
  const j = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } }
  const items = j.tracks?.items ?? []
  return items.map(tr => ({
    id: tr.id,
    name: tr.name,
    artist: tr.artists?.[0]?.name ?? 'Unknown',
    artistId: tr.artists?.[0]?.id ?? '',
    albumArtUrl: (tr.album?.images ?? [])[0]?.url,
  }))
}

export async function searchArtists(q: string) {
  const token = await getSpotifyToken()
  const res = await fetch(
    `https://api.spotify.com/v1/search?type=artist&limit=10&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  )
  if (!res.ok) return []
  const j = (await res.json()) as { artists?: { items?: SpotifyArtist[] } }
  const items = j.artists?.items ?? []
  return items.map(a => ({
    id: a.id,
    name: a.name,
    imageUrl: (a.images ?? []).sort((x, y) => (y.width ?? 0) - (x.width ?? 0))[0]?.url,
  }))
}

export async function searchLivesAction(q: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('lives_v2')
    .select('id, name, venue, live_date')
    .ilike('name', `%${q}%`)
    .limit(20)
  return (data ?? []).map(r => ({
    id: String(r.id),
    name: r.name as string,
    venue: r.venue ?? null,
    live_date: r.live_date ?? null,
  }))
}

/** =========================================================
 * 投稿作成＋ tags_v2 保存（A案：動画はUUIDに解決）
 * ======================================================= */
export async function createPost(content: string, tags: Tag[]) {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user?.id) throw new Error('ログインが必要です。')

  // posts
  const { data: postRow, error: postErr } = await supabase
    .from('posts')
    .insert({ user_id: auth.user.id, content })
    .select('id')
    .single()
  if (postErr || !postRow?.id) throw new Error(postErr?.message ?? '投稿作成に失敗しました。')
  const postId = postRow.id as number

  // Spotify token は必要な時だけ
  const needSpotify = tags.some(t => t.type === 'song' || t.type === 'artist')
  const spotifyToken = needSpotify ? await getSpotifyToken() : ''

  for (const t of tags) {
    if (t.type === 'artist') {
      // Spotify アーティストID（/URL） → artists_v2 を確保 → UUID で保存
      const sid = extractSpotifyId(t.id) ?? t.id
      const artistUuid = await ensureArtistBySpotifyId(sid, spotifyToken)
      const { error } = await supabase
        .from('tags_v2')
        .insert({ post_id: postId, artist_id: artistUuid })
      if (error) throw new Error(`アーティストタグの保存に失敗しました: ${error.message}`)
    }

    if (t.type === 'song') {
      // Spotify トラックID（/URL） → songs_v2 を確保 → UUID で保存
      const tid = extractSpotifyId(t.id) ?? t.id
      const songUuid = await ensureSongBySpotifyTrackId(tid, spotifyToken)
      const { error } = await supabase
        .from('tags_v2')
        .insert({ post_id: postId, song_id: songUuid })
      if (error) throw new Error(`楽曲タグの保存に失敗しました: ${error.message}`)
    }

    if (t.type === 'live') {
      const liveId = Number(t.id)
      if (Number.isFinite(liveId)) {
        const { error } = await supabase
          .from('tags_v2')
          .insert({ post_id: postId, live_id: liveId })
        if (error) throw new Error(`ライブタグの保存に失敗しました: ${error.message}`)
      }
    }

    if (t.type === 'video') {
      // まずDBに既にあるか（UUID / youtube_video_id / URL解析）で探す
      let videoUuid = await findVideoUuidFromAny(t.id)

      if (!videoUuid) {
        // 見つからなければ URL/ID を解析して新規作成
        const yid = parseYouTubeVideoId(t.id)
        if (!yid) throw new Error('動画URL/IDが無効です。')
        // YouTube メタを取って videos に insert（ENUM 値はDBに追加済みであること）
        videoUuid = await ensureVideoByYouTubeId(yid, 'original_song')
      }

      const { error } = await supabase
        .from('tags_v2')
        .insert({ post_id: postId, video_id: videoUuid })
      if (error) throw new Error(`動画タグの保存に失敗しました: ${error.message}`)
    }
  }

  revalidatePath('/') // 必要に応じて調整
  return { success: true, postId }
}
