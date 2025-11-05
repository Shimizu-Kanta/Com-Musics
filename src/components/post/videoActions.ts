'use server'

import { createClient } from '@/lib/supabase/server'
import type { Tag } from '@/app/(main)/post/actions'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? ''
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? ''
const YT_API_KEY = process.env.YOUTUBE_API_KEY ?? ''

type Result = { error?: string; tag?: Tag }
type VideoType = 'original_song' | 'cover' | 'live_performance'

/* ======================= Spotify ======================= */

const SPOTIFY_ID_22 = /^[0-9A-Za-z]{22}$/

type SpotifyTokenRes = { access_token: string }
type SpotifyArtist = { id: string; name: string; images?: { url: string; width?: number }[] }
type SpotifyTrack = {
  id: string
  name: string
  album?: { images?: { url: string; width?: number }[] }
  artists: { id: string; name: string }[]
}

async function getSpotifyToken(): Promise<string> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) throw new Error('Spotifyクレデンシャル未設定')
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

function extractSpotifyId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (SPOTIFY_ID_22.test(s)) return s
  try {
    const u = new URL(s)
    const parts = u.pathname.split('/').filter(Boolean) // /artist/{id} or /track/{id}
    const maybe = parts[1]
    return SPOTIFY_ID_22.test(maybe ?? '') ? (maybe as string) : null
  } catch { return null }
}

async function fetchSpotifyArtist(id: string, token: string): Promise<SpotifyArtist | null> {
  const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  return res.ok ? ((await res.json()) as SpotifyArtist) : null
}

async function fetchSpotifyTrack(id: string, token: string): Promise<SpotifyTrack | null> {
  const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  return res.ok ? ((await res.json()) as SpotifyTrack) : null
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
  // 曲のアーティストを song_artists に反映（複数アーティストを全員保存）
  for (const a of tr.artists) {
    const aid = await ensureArtistBySpotifyId(a.id, token)
    await supabase.from('song_artists').upsert({ song_id: songId, artist_id: aid }, { onConflict: 'song_id,artist_id' })
  }
  return songId
}

/** ★公開：楽曲（Spotify）を upsert → songs_v2.id を返す（VideoTagModal から呼ぶ） */
export async function addSongFromSpotify(input: string): Promise<
  | { ok: true; id: string; title: string; imageUrl: string | null }
  | { ok: false; error: string }
> {
  try {
    const tid = extractSpotifyId(input)
    if (!tid) return { ok: false, error: 'SpotifyのトラックID/URLを入力してください。' }
    const token = await getSpotifyToken()
    const id = await ensureSongBySpotifyTrackId(tid, token)
    const supabase = createClient()
    const { data, error } = await supabase.from('songs_v2').select('title, image_url').eq('id', id).single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, id, title: (data?.title ?? 'Song') as string, imageUrl: (data?.image_url ?? null) as string | null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラーです'
    return { ok: false, error: msg }
  }
}

/* ======================= YouTube: 動画 ======================= */

type YtVideoItem = {
  id?: string
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
}

async function fetchYouTubeVideo(id: string): Promise<{ title: string; categoryId: string | null; thumbnail: string | null } | null> {
  if (!YT_API_KEY) throw new Error('YouTube APIキー未設定')
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(id)}&key=${YT_API_KEY}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const j = (await res.json()) as { items?: YtVideoItem[] }
  const it = j.items?.[0]
  if (!it?.snippet?.title) return null
  const sn = it.snippet
  const thumb =
    sn.thumbnails?.maxres?.url ??
    sn.thumbnails?.standard?.url ??
    sn.thumbnails?.high?.url ??
    sn.thumbnails?.medium?.url ??
    sn.thumbnails?.default?.url ??
    null
  return { title: sn.title ?? id, categoryId: sn.categoryId ?? null, thumbnail: thumb }
}

/* ======================= メイン保存 ======================= */

export async function saveVideoAndCreateTag(formData: FormData): Promise<Result> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user?.id) return { error: 'ログインが必要です。' }

  const youtube_video_id = String(formData.get('youtube_video_id') ?? '')
  const video_type = String(formData.get('video_type') ?? '')

  // 新UI：複数アーティスト／複数曲
  const artistIds = formData.getAll('artistIds').map(String).filter(Boolean)
  const songIds = Array.from(new Set(formData.getAll('songIds').map(String).filter(Boolean))) // 重複排除

  // 旧互換：単一曲（残置）
  const songSpotifyTrackIdRaw = String(formData.get('songSpotifyTrackId') ?? '')

  if (!youtube_video_id || !video_type) return { error: '必要な項目が不足しています。' }

  // YouTubeメタから正値で保存
  const meta = await fetchYouTubeVideo(youtube_video_id)
  if (!meta) return { error: 'YouTube動画情報の取得に失敗しました。' }
  const title = meta.title
  const thumbnail_url = meta.thumbnail ?? null
  const youtube_category_id = meta.categoryId ?? null

  // videos を作成/取得（既存があれば最新メタで更新）
  const { data: existing } = await supabase
    .from('videos')
    .select('id')
    .eq('youtube_video_id', youtube_video_id)
    .maybeSingle()

  let videoId: string
  if (existing?.id) {
    videoId = existing.id as string
    await supabase.from('videos').update({ title, thumbnail_url, youtube_category_id }).eq('id', videoId)
  } else {
    const { data: videoRow, error: vErr } = await supabase
      .from('videos')
      .insert({ title, youtube_video_id, thumbnail_url, video_type, youtube_category_id })
      .select('id')
      .single()
    if (vErr || !videoRow?.id) return { error: vErr?.message ?? '動画の作成に失敗しました。' }
    videoId = videoRow.id as string
  }

  // ===== アーティスト紐付け（複数）=====
  try {
    if (artistIds.length > 0) {
      let idx = 0
      for (const aid of artistIds) {
        await supabase
          .from('video_artists')
          .upsert({ video_id: videoId, artist_id: aid, role: idx === 0 ? 'primary' : 'featured', sort_order: idx }, { onConflict: 'video_id,artist_id' })
        idx += 1
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'アーティスト紐付けに失敗しました。'
    return { error: msg }
  }

  // ===== 楽曲紐付け（複数）=====
  try {
    if (songIds.length > 0) {
      let idx = 0
      for (const sid of songIds) {
        await supabase
          .from('video_songs')
          .upsert({ video_id: videoId, song_id: sid, sort_order: idx }, { onConflict: 'video_id,sort_order' })
        idx += 1
      }
    } else if (songSpotifyTrackIdRaw) {
      // 旧互換：単一曲が直接入力されていた場合（新UIでは通常未使用）
      const token = await getSpotifyToken()
      const tid = extractSpotifyId(songSpotifyTrackIdRaw)
      if (!tid) throw new Error('SpotifyトラックID/URLが無効です。')
      const songUuid = await ensureSongBySpotifyTrackId(tid, token)
      await supabase
        .from('video_songs')
        .upsert({ video_id: videoId, song_id: songUuid, sort_order: 0 }, { onConflict: 'video_id,sort_order' })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '楽曲紐付けに失敗しました。'
    return { error: msg }
  }

  // タグ候補を返す（投稿画面で tags_v2 へ保存）
  const tag: Tag = { type: 'video', id: videoId, name: title, imageUrl: thumbnail_url ?? undefined }
  return { tag }
}
