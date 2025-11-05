'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type Tag =
  | { type: 'artist'; id: string; name: string; imageUrl?: string }
  | { type: 'song';   id: string; name: string; imageUrl?: string; artistName?: string }
  | { type: 'live';   id: string; name: string; venue?: string | null; liveDate?: string | null }
  | { type: 'video';  id: string; name: string; imageUrl?: string; artistName?: string }

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? ''
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? ''
const YT_API_KEY = process.env.YOUTUBE_API_KEY ?? ''

const UUID_RE = /^[0-9a-f-]{36}$/i
const SPOTIFY_ID_22 = /^[0-9A-Za-z]{22}$/
const YT_CHANNEL_ID = /^UC[0-9A-Za-z_-]{22}$/

function assertEnvSpotify() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotifyクレデンシャル未設定（SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET）')
  }
}

/* ---------------- Spotify helpers ---------------- */

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
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Spotify token取得失敗')
  const json = (await res.json()) as SpotifyTokenRes
  return json.access_token
}

async function fetchSpotifyArtist(id: string, token: string): Promise<SpotifyArtist | null> {
  const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'ja' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as SpotifyArtist
}

async function fetchSpotifyTrack(id: string, token: string): Promise<SpotifyTrack | null> {
  const res = await fetch(`https://api.spotify.com/v1/tracks/${id}?market=JP`, {
    headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'ja' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as SpotifyTrack
}

function extractSpotifyId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (SPOTIFY_ID_22.test(s)) return s
  try {
    const u = new URL(s)
    const parts = u.pathname.split('/').filter(Boolean)
    const maybe = parts[1]
    return SPOTIFY_ID_22.test(maybe ?? '') ? (maybe as string) : null
  } catch {
    return null
  }
}

async function ensureArtistBySpotifyId(spotifyId: string, token: string): Promise<string> {
  const supabase = createClient()
  { const { data } = await supabase.from('artists_v2').select('id').eq('spotify_id', spotifyId).maybeSingle(); if (data?.id) return data.id }
  const art = await fetchSpotifyArtist(spotifyId, token)
  if (!art) throw new Error('Spotifyアーティスト取得失敗')
  const img = (art.images ?? []).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null
  const { data, error } = await supabase
    .from('artists_v2')
    .upsert({ spotify_id: art.id, name: art.name, image_url: img }, { onConflict: 'spotify_id' })
    .select('id')
    .single()
  if (error || !data?.id) throw new Error(error?.message ?? 'artists_v2 upsert失敗')
  return data.id
}

async function ensureSongBySpotifyTrackId(trackId: string, token: string): Promise<string> {
  const supabase = createClient()
  { const { data } = await supabase.from('songs_v2').select('id').eq('spotify_id', trackId).maybeSingle(); if (data?.id) return data.id }
  const tr = await fetchSpotifyTrack(trackId, token)
  if (!tr) throw new Error('Spotifyトラック取得失敗')
  const cover = (tr.album?.images ?? []).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null
  const { data, error } = await supabase
    .from('songs_v2')
    .upsert({ spotify_id: tr.id, title: tr.name, image_url: cover }, { onConflict: 'spotify_id' })
    .select('id')
    .single()
  if (error || !data?.id) throw new Error(error?.message ?? 'songs_v2 upsert失敗')
  const songId = data.id as string
  for (const a of tr.artists) {
    const aid = await ensureArtistBySpotifyId(a.id, token)
    await supabase.from('song_artists').upsert({ song_id: songId, artist_id: aid }, { onConflict: 'song_id,artist_id' })
  }
  return songId
}

/* ---------------- YouTube helpers（動画/チャンネル） ---------------- */

function parseYouTubeVideoId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  try {
    if (/^[A-Za-z0-9_-]{10,}$/.test(s) && !s.includes('://')) return s
    const u = new URL(s)
    const host = u.hostname.replace(/^www\./, '')
    const parts = u.pathname.split('/').filter(Boolean)
    const v = u.searchParams.get('v')
    if (v) return v
    if (host === 'youtu.be') return parts[0] ?? null
    if (host.endsWith('youtube.com') && parts.length >= 2 && ['shorts','live','embed','v'].includes(parts[0])) {
      return parts[1]
    }
  } catch {}
  return null
}

async function fetchYouTubeMeta(yid: string): Promise<{ title: string; categoryId: string | null; thumbnail: string | null }> {
  if (!YT_API_KEY) throw new Error('YouTube APIキー未設定')
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(yid)}&key=${YT_API_KEY}`
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
  return { title: sn.title, categoryId: sn.categoryId ?? null, thumbnail: thumb }
}

/** ★モーダル表示用：入力（URL/ID）→ 動画タイトル等を解決して返す */
export async function getYouTubeMetaForModal(input: string): Promise<
  | { ok: true; data: { youtube_video_id: string; title: string; thumbnail_url: string; youtube_category_id: string } }
  | { ok: false; error: string }
> {
  try {
    const yid = parseYouTubeVideoId(input)
    if (!yid) return { ok: false, error: 'YouTubeのURL/IDを入力してください。' }
    const meta = await fetchYouTubeMeta(yid)
    return {
      ok: true,
      data: {
        youtube_video_id: yid,
        title: meta.title,
        thumbnail_url: meta.thumbnail ?? `https://i.ytimg.com/vi/${yid}/hqdefault.jpg`,
        youtube_category_id: meta.categoryId ?? '0',
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラーです'
    return { ok: false, error: msg }
  }
}

/* ---------------- YouTube：チャンネル → artists_v2 ---------------- */

type YtChannelSnippet = {
  title?: string
  thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } }
}

async function fetchYouTubeChannelById(channelId: string): Promise<{ title: string; imageUrl: string | null } | null> {
  if (!YT_API_KEY) throw new Error('YouTube APIキー未設定')
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(channelId)}&key=${YT_API_KEY}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const j = (await res.json()) as { items?: { snippet?: YtChannelSnippet }[] }
  const sn = j.items?.[0]?.snippet
  if (!sn?.title) return null
  const img = sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null
  return { title: sn.title, imageUrl: img }
}

async function fetchYouTubeChannelByHandle(handle: string): Promise<{ channelId: string; title: string; imageUrl: string | null } | null> {
  if (!YT_API_KEY) throw new Error('YouTube APIキー未設定')
  const clean = handle.startsWith('@') ? handle.slice(1) : handle
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(clean)}&key=${YT_API_KEY}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const j = (await res.json()) as { items?: { id?: string; snippet?: YtChannelSnippet }[] }
  const it = j.items?.[0]
  const sn = it?.snippet
  const channelId = it?.id
  if (!sn?.title || !channelId) return null
  const img = sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null
  return { channelId, title: sn.title, imageUrl: img }
}

function parseYouTubeChannelInput(input: string): { kind: 'id' | 'handle'; value: string } | null {
  const s = input.trim()
  if (!s) return null
  if (s.startsWith('@')) return { kind: 'handle', value: s }
  if (YT_CHANNEL_ID.test(s)) return { kind: 'id', value: s }
  try {
    const u = new URL(s)
    if (!u.hostname.includes('youtube.com')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts[0] === 'channel' && YT_CHANNEL_ID.test(parts[1] ?? '')) return { kind: 'id', value: parts[1]! }
    if (parts[0]?.startsWith('@')) return { kind: 'handle', value: parts[0]! }
    return null
  } catch { return null }
}

export async function addArtistFromSpotify(input: string): Promise<
  | { ok: true; id: string; name: string; imageUrl: string | null }
  | { ok: false; error: string }
> {
  try {
    const sid = extractSpotifyId(input)
    if (!sid) return { ok: false, error: 'SpotifyのアーティストID/URLを入力してください。' }
    const token = await getSpotifyToken()
    const id = await ensureArtistBySpotifyId(sid, token)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('artists_v2')
      .select('name, image_url')
      .eq('id', id)
      .single()
    if (error) return { ok: false, error: error.message }

    return { ok: true, id, name: (data?.name ?? 'Artist') as string, imageUrl: (data?.image_url ?? null) as string | null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラーです'
    return { ok: false, error: msg }
  }
}

export async function addArtistFromYouTubeChannel(input: string): Promise<
  | { ok: true; id: string; name: string; imageUrl: string | null }
  | { ok: false; error: string }
> {
  try {
    const parsed = parseYouTubeChannelInput(input)
    if (!parsed) return { ok: false, error: 'チャンネルURL または @handle を入力してください。' }

    let channelId: string | null = null
    let title: string | null = null
    let imageUrl: string | null = null

    if (parsed.kind === 'id') {
      const meta = await fetchYouTubeChannelById(parsed.value)
      if (!meta) return { ok: false, error: 'YouTubeチャンネル情報を取得できませんでした。' }
      channelId = parsed.value
      title = meta.title
      imageUrl = meta.imageUrl
    } else {
      const meta = await fetchYouTubeChannelByHandle(parsed.value)
      if (!meta) return { ok: false, error: 'YouTubeハンドルからチャンネルを解決できませんでした。' }
      channelId = meta.channelId
      title = meta.title
      imageUrl = meta.imageUrl
    }

    if (!channelId || !title) return { ok: false, error: 'YouTubeチャンネルの解決に失敗しました。' }

    const supabase = createClient()
    { const { data } = await supabase.from('artists_v2').select('id, name, image_url').eq('youtube_channel_id', channelId).maybeSingle()
      if (data?.id) return { ok: true, id: data.id as string, name: (data.name ?? title) as string, imageUrl: (data.image_url ?? imageUrl) as string | null }
    }

    const { data, error } = await supabase
      .from('artists_v2')
      .upsert({ youtube_channel_id: channelId, name: title, image_url: imageUrl }, { onConflict: 'youtube_channel_id' })
      .select('id')
      .single()
    if (error || !data?.id) return { ok: false, error: error?.message ?? 'artists_v2 の作成に失敗しました。' }

    return { ok: true, id: data.id as string, name: title, imageUrl }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラーです'
    return { ok: false, error: msg }
  }
}

/* ---------------- 検索アクション（画像＋日本語寄りに） ---------------- */

export async function searchMusic(q: string) {
  const token = await getSpotifyToken()
  const url = `https://api.spotify.com/v1/search?type=track&limit=10&market=JP&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'ja' }, cache: 'no-store' })
  if (!res.ok) return []
  const j = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } }
  const items = j.tracks?.items ?? []
  return items.map(tr => ({
    id: tr.id,
    name: tr.name,
    artist: tr.artists?.[0]?.name ?? 'Unknown',
    artistId: tr.artists?.[0]?.id ?? '',
    albumArtUrl: (tr.album?.images ?? []).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url,
  }))
}

export async function searchArtists(q: string) {
  const token = await getSpotifyToken()
  const url = `https://api.spotify.com/v1/search?type=artist&limit=10&market=JP&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'ja' }, cache: 'no-store' })
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
  return (data ?? []).map(r => ({
    id: String(r.id),
    name: r.name as string,
    venue: r.venue ?? null,
    live_date: r.live_date ?? null,
  }))
}

/* ---------------- 投稿作成（変更なし：UUID優先） ---------------- */

export async function createPost(content: string, tags: Tag[]) {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user?.id) throw new Error('ログインが必要です。')

  const { data: postRow, error: postErr } = await supabase
    .from('posts')
    .insert({ user_id: auth.user.id, content })
    .select('id')
    .single()
  if (postErr || !postRow?.id) throw new Error(postErr?.message ?? '投稿作成に失敗しました。')
  const postId = postRow.id as number

  const needSpotifyFallback = tags.some(t => t.type === 'song' || (t.type === 'artist' && !UUID_RE.test(t.id)))
  const spotifyToken = needSpotifyFallback ? await getSpotifyToken() : ''

  for (const t of tags) {
    if (t.type === 'artist') {
      if (UUID_RE.test(t.id)) {
        const { error } = await supabase.from('tags_v2').insert({ post_id: postId, artist_id: t.id })
        if (error) throw new Error(`アーティストタグの保存に失敗しました: ${error.message}`)
      } else {
        const sid = extractSpotifyId(t.id)
        if (!sid) throw new Error('アーティストは Spotify 検索で選択するか、YouTubeチャンネル（URL/@handle）で追加してください。')
        const artistUuid = await ensureArtistBySpotifyId(sid, spotifyToken)
        const { error } = await supabase.from('tags_v2').insert({ post_id: postId, artist_id: artistUuid })
        if (error) throw new Error(`アーティストタグの保存に失敗しました: ${error.message}`)
      }
    }

    if (t.type === 'song') {
      const tid = extractSpotifyId(t.id) ?? t.id
      const songUuid = await ensureSongBySpotifyTrackId(tid, spotifyToken)
      const { error } = await supabase.from('tags_v2').insert({ post_id: postId, song_id: songUuid })
      if (error) throw new Error(`楽曲タグの保存に失敗しました: ${error.message}`)
    }

    if (t.type === 'live') {
      const liveId = Number(t.id)
      if (Number.isFinite(liveId)) {
        const { error } = await supabase.from('tags_v2').insert({ post_id: postId, live_id: liveId })
        if (error) throw new Error(`ライブタグの保存に失敗しました: ${error.message}`)
      }
    }

    if (t.type === 'video') {
      const { error } = await supabase.from('tags_v2').insert({ post_id: postId, video_id: t.id })
      if (error) throw new Error(`動画タグの保存に失敗しました: ${error.message}`)
    }
  }

  revalidatePath('/')
  return { success: true, postId }
}
