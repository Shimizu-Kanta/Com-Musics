'use server'

import { createClient } from '@/lib/supabase/server'
import type { Tag } from '@/app/(main)/post/actions'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? ''
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? ''
const YT_API_KEY = process.env.YOUTUBE_API_KEY ?? ''

const SPOTIFY_ID_22 = /^[0-9A-Za-z]{22}$/

type Result = { error?: string; tag?: Tag }

type SpotifyTokenRes = { access_token: string }
type SpotifyArtist = { id: string; name: string; images?: { url: string; width?: number }[] }
type SpotifyTrack = {
  id: string
  name: string
  album?: { images?: { url: string; width?: number }[] }
  artists: { id: string; name: string }[]
}

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

/* ========== Spotify helpers ========== */
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
async function fetchSpotifyArtist(id: string, token: string): Promise<SpotifyArtist | null> {
  const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  return res.ok ? ((await res.json()) as SpotifyArtist) : null
}
async function fetchSpotifyTrack(id: string, token: string): Promise<SpotifyTrack | null> {
  const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  return res.ok ? ((await res.json()) as SpotifyTrack) : null
}
function extractSpotifyId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (SPOTIFY_ID_22.test(s)) return s
  try {
    const u = new URL(s)
    const parts = u.pathname.split('/').filter(Boolean) // /track/{id} or /artist/{id}
    const maybe = parts[1]
    return SPOTIFY_ID_22.test(maybe ?? '') ? (maybe as string) : null
  } catch { return null }
}
async function ensureArtistBySpotifyId(spotifyId: string, token: string): Promise<string> {
  const supabase = createClient()
  { const { data } = await supabase.from('artists_v2').select('id').eq('spotify_id', spotifyId).maybeSingle(); if (data?.id) return data.id }
  const art = await fetchSpotifyArtist(spotifyId, token)
  if (!art) throw new Error('Spotifyアーティスト取得失敗')
  const img = (art.images ?? []).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null
  const { data, error } = await supabase.from('artists_v2').upsert({ spotify_id: art.id, name: art.name, image_url: img }, { onConflict: 'spotify_id' }).select('id').single()
  if (error || !data?.id) throw new Error(error?.message ?? 'artists_v2 upsert失敗')
  return data.id
}
async function ensureSongBySpotifyTrackId(trackId: string, token: string): Promise<string> {
  const supabase = createClient()
  { const { data } = await supabase.from('songs_v2').select('id').eq('spotify_id', trackId).maybeSingle(); if (data?.id) return data.id }
  const tr = await fetchSpotifyTrack(trackId, token)
  if (!tr) throw new Error('Spotifyトラック取得失敗')
  const cover = (tr.album?.images ?? []).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null
  const { data, error } = await supabase.from('songs_v2').upsert({ spotify_id: tr.id, title: tr.name, image_url: cover }, { onConflict: 'spotify_id' }).select('id').single()
  if (error || !data?.id) throw new Error(error?.message ?? 'songs_v2 upsert失敗')
  const songId = data.id as string
  for (const a of tr.artists) {
    const aid = await ensureArtistBySpotifyId(a.id, token)
    await supabase.from('song_artists').upsert({ song_id: songId, artist_id: aid }, { onConflict: 'song_id,artist_id' })
  }
  return songId
}

/* ========== YouTube helpers ========== */
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

/* ========== メイン：動画保存＋中間テーブル＋タグ返却 ========== */
export async function saveVideoAndCreateTag(formData: FormData): Promise<Result> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user?.id) return { error: 'ログインが必要です。' }

  const youtube_video_id = String(formData.get('youtube_video_id') ?? '')
  const video_type = String(formData.get('video_type') ?? '')

  const artistSpotifyIdRaw = String(formData.get('artistSpotifyId') ?? '')
  const songSpotifyTrackIdRaw = String(formData.get('songSpotifyTrackId') ?? '')

  if (!youtube_video_id || !video_type) return { error: '必要な項目が不足しています。' }

  // YouTube メタデータを取得（常に正値で保存）
  const meta = await fetchYouTubeVideo(youtube_video_id)
  if (!meta) return { error: 'YouTube動画情報の取得に失敗しました。' }
  const title = meta.title
  const thumbnail_url = meta.thumbnail ?? null
  const youtube_category_id = meta.categoryId ?? null

  // videos を作成/取得（既存があれば最新メタで更新）
  const { data: existing } = await supabase.from('videos').select('id').eq('youtube_video_id', youtube_video_id).maybeSingle()
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

  // 任意：アーティスト/楽曲の中間テーブル（各1件、sort_order=0）に紐付け
  const needSpotify = !!artistSpotifyIdRaw || !!songSpotifyTrackIdRaw
  const token = needSpotify ? await getSpotifyToken() : ''

  if (artistSpotifyIdRaw) {
    const sid = extractSpotifyId(artistSpotifyIdRaw)
    if (sid) {
      const artistUuid = await ensureArtistBySpotifyId(sid, token)
      const { data: exists } = await supabase
        .from('video_artists')
        .select('video_id')
        .eq('video_id', videoId)
        .eq('artist_id', artistUuid)
        .maybeSingle()
      if (!exists) {
        await supabase
          .from('video_artists')
          .upsert({ video_id: videoId, artist_id: artistUuid, role: 'primary', sort_order: 0 }, { onConflict: 'video_id,artist_id' })
      }
    }
  }

  if (songSpotifyTrackIdRaw) {
    const tid = extractSpotifyId(songSpotifyTrackIdRaw)
    if (tid) {
      const songUuid = await ensureSongBySpotifyTrackId(tid, token)
      const { data: exists } = await supabase
        .from('video_songs')
        .select('video_id')
        .eq('video_id', videoId)
        .eq('song_id', songUuid)
        .maybeSingle()
      if (!exists) {
        await supabase
          .from('video_songs')
          .upsert({ video_id: videoId, song_id: songUuid, sort_order: 0 }, { onConflict: 'video_id,sort_order' })
      }
    }
  }

  // タグ候補を返す（投稿送信時に tags_v2 へ保存される）
  const tag: Tag = { type: 'video', id: videoId, name: title, imageUrl: thumbnail_url ?? undefined }
  return { tag }
}
