'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
// TagSearch.tsx から Tag 型をインポート
import type { Tag } from './TagSearch'
// TagSearch.tsx が使っている既存のSpotify検索アクションをインポート
import { searchMusic, searchArtistsAction} from '@/app/(main)/post/actions'

// 1. YouTube API (videos.list) のための型定義
interface YouTubeVideoListResponse {
  items: {
    id: string
    snippet: {
      title: string
      thumbnails: { medium: { url: string } }
      categoryId: string
    }
  }[]
  error?: { message: string }
}

// 2. 「管制塔」に渡す、一時データの型
type PendingVideoData = {
  youtube_video_id: string
  title: string
  thumbnail_url: string
  youtube_category_id: string
}

/**
 * YouTubeのURLを解析して動画IDを抽出する
 */
function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1)
    }
    if (urlObj.hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v')
      if (videoId) return videoId
    }
    return null
  } catch {
    return null
  }
}

/**
 * アクション1: URLから動画情報を取得する
 */
export async function getVideoInfo(
  url: string,
): Promise<{ data?: PendingVideoData; error?: string }> {
  // ... (この関数は変更ありません) ...
  const youtube_video_id = extractVideoId(url)
  if (!youtube_video_id) {
    return { error: '有効なYouTubeのURLを解析できませんでした。' }
  }
  const supabase = createClient()
  const { data: existingVideo, error: dbError } = await supabase
    .from('videos_test')
    .select('title, thumbnail_url, youtube_category_id')
    .eq('youtube_video_id', youtube_video_id)
    .single()
  if (dbError && dbError.code !== 'PGRST116') {
    return { error: `DB検索エラー: ${dbError.message}` }
  }
  if (existingVideo) {
    return {
      data: {
        youtube_video_id,
        title: existingVideo.title,
        thumbnail_url: existingVideo.thumbnail_url || '',
        youtube_category_id: existingVideo.youtube_category_id || '',
      },
    }
  }
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return { error: 'YouTube APIキーが設定されていません。' }
  }
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${youtube_video_id}&key=${apiKey}`
  try {
    const response = await fetch(apiUrl)
    const data: YouTubeVideoListResponse = await response.json()
    if (data.error || data.items.length === 0) {
      return { error: `APIエラー: ${data.error?.message || '動画が見つかりません'}` }
    }
    const item = data.items[0]
    return {
      data: {
        youtube_video_id,
        title: item.snippet.title,
        thumbnail_url: item.snippet.thumbnails.medium.url,
        youtube_category_id: item.snippet.categoryId,
      },
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { error: `APIリクエストエラー: ${err.message}` }
    }
    return { error: '不明なAPIエラー' }
  }
}

/**
 * アクション2: 動画をDBに保存し、完成した「タグ」を返す
 */
// ... (videoSchema と VideoWithArtist の型定義は変更ありません) ...
const videoSchema = z.object({
  youtube_video_id: z.string(),
  title: z.string(),
  thumbnail_url: z.string(),
  youtube_category_id: z.string(),
  video_type: z.enum(['original_song', 'cover', 'live_performance']),
  artist_id: z.string().uuid().nullable(),
  original_song_id: z.string().uuid().nullable(),
})
type VideoWithArtist = {
  id: string
  artists_test: { name: string }[] | null
}

export async function saveVideoAndCreateTag(
  formData: FormData,
): Promise<{ tag?: Tag; error?: string }> {
  // ... (この関数の前半（videoの取得まで）は変更ありません) ...
  const validatedFields = videoSchema.safeParse({
    youtube_video_id: formData.get('youtube_video_id'),
    title: formData.get('title'),
    thumbnail_url: formData.get('thumbnail_url'),
    youtube_category_id: formData.get('youtube_category_id'),
    video_type: formData.get('video_type'),
    artist_id: formData.get('artist_id') || null,
    original_song_id: formData.get('original_song_id') || null,
  })
  if (!validatedFields.success) {
    return { error: `入力が無効です: ${validatedFields.error.flatten().fieldErrors}` }
  }
  if (!validatedFields.data.artist_id) {
    return { error: 'アーティストは必須です。' }
  }
  const supabase = createClient()
  const { data: initialVideo, error } = await supabase
    .from('videos_test')
    .select('id, artists_test(name)')
    .eq('youtube_video_id', validatedFields.data.youtube_video_id)
    .single<VideoWithArtist>()
  if (error && error.code !== 'PGRST116') {
    return { error: `DB検索エラー: ${error.message}` }
  }
  let video: VideoWithArtist | null = initialVideo
  if (!video) {
    const { data: newVideo, error: insertError } = await supabase
      .from('videos_test')
      .insert({
        youtube_video_id: validatedFields.data.youtube_video_id,
        title: validatedFields.data.title,
        thumbnail_url: validatedFields.data.thumbnail_url,
        youtube_category_id: validatedFields.data.youtube_category_id,
        video_type: validatedFields.data.video_type,
        artist_id: validatedFields.data.artist_id,
        original_song_id: validatedFields.data.original_song_id,
      })
      .select('id, artists_test(name)')
      .single<VideoWithArtist>()
    if (insertError) {
      return { error: `DB保存エラー: ${insertError.message}` }
    }
    video = newVideo
  }
  if (!video) {
    return { error: '動画の登録または取得に失敗しました。' }
  }
  return {
    tag: {
      type: 'video',
      id: video.id,
      name: validatedFields.data.title,
      imageUrl: validatedFields.data.thumbnail_url,
      artistName: video.artists_test?.[0]?.name || '不明',
      artistId: validatedFields.data.artist_id,
      youtube_video_id: validatedFields.data.youtube_video_id,
    },
  }
}

// ▼▼▼ ここからが「Get or Create」の新機能 ▼▼▼

/**
 * アクション3: Spotifyアーティストを検索する
 */
export async function searchSpotifyArtists(query: string) {
  // ... (この関数は変更ありません) ...
  if (query.length < 2) return []
  return searchArtistsAction(query)
}

/**
 * アクション4: Spotifyの曲を検索する
 */
export async function searchSpotifySongs(query: string) {
  // ... (この関数は変更ありません) ...
  if (query.length < 2) return []
  return searchMusic(query)
}

// ... (SpotifyArtist と SpotifySong の型定義は変更ありません) ...
type SpotifyArtist = {
  id: string
  name: string
  imageUrl?: string
}
type SpotifySong = {
  id: string
  name: string
  artist: string
  artistId: string
  albumArtUrl?: string
}

/**
 * アクション5: Get or Create (アーティスト編)
 */
export async function getOrCreateArtist(
  artist: SpotifyArtist,
): Promise<{ id: string; name: string } | { error: string }> {
  // ... (この関数は変更ありません) ...
  const supabase = createClient()
  const { data: existing, error: findError } = await supabase
    .from('artists_test')
    .select('id, name')
    .eq('spotify_id', artist.id)
    .single()
  if (findError && findError.code !== 'PGRST116') {
    return { error: `DB検索エラー: ${findError.message}` }
  }
  if (existing) {
    return existing
  }
  const { data: newArtist, error: insertError } = await supabase
    .from('artists_test')
    .insert({
      name: artist.name,
      spotify_id: artist.id,
      image_url: artist.imageUrl,
    })
    .select('id, name')
    .single()
  if (insertError) {
    return { error: `アーティスト登録エラー: ${insertError.message}` }
  }
  return newArtist
}

/**
 * アクション6: Get or Create (楽曲編)
 */
export async function getOrCreateSong(
  song: SpotifySong,
): Promise<{ id: string } | { error: string }> {
  const supabase = createClient()

  // 1. Spotify IDで既存の曲を検索
  const { data: existing, error: findError } = await supabase
    .from('songs_test')
    .select('id')
    .eq('spotify_id', song.id)
    .single()

  if (findError && findError.code !== 'PGRST116') {
    return { error: `DB検索エラー: ${findError.message}` }
  }
  if (existing) {
    return existing // 存在したら、そのIDを返す
  }

  // ▼▼▼【重要】ここが今回の修正点です ▼▼▼
  
  // 2. 存在しない場合、まず「アーティスト」のUUIDを取得 (Get or Create)
  const artistResult = await getOrCreateArtist({
    id: song.artistId,
    name: song.artist,
    // (曲検索からはアーティスト画像が取れない)
  })

  // 2B. エラーチェックを先に行う
  if ('error' in artistResult) {
    return { error: artistResult.error }
  }

  // 2C. エラーがないことを確認してから、id を取り出す
  const artistUuid = artistResult.id
  
  // ▲▲▲

  // 3. 曲を新規作成
  const { data: newSong, error: insertSongError } = await supabase
    .from('songs_test')
    .insert({
      title: song.name,
      spotify_id: song.id,
      image_url: song.albumArtUrl,
    })
    .select('id')
    .single()

  if (insertSongError || !newSong) {
    return { error: `曲登録エラー: ${insertSongError?.message || '不明なエラー'}` }
  }

  // 4. 中間テーブル (song_artists_test) に紐付け
  const { error: junctionError } = await supabase
    .from('song_artists_test')
    .insert({
      song_id: newSong.id,
      artist_id: artistUuid, // これで artistUuid が安全に使える
    })

  if (junctionError) {
    return { error: `中間テーブル登録エラー: ${junctionError.message}` }
  }

  return newSong
}