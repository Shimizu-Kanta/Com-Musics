'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server' // server用supabaseをインポート

// APIのレスポンスの「型」を定義
export interface YouTubeVideo {
  id: string
  title: string
  thumbnailUrl: string
  channelTitle: string
}

// YouTube API (search.list) から返ってくる item の型
interface YouTubeSearchItem {
  id: {
    videoId: string
  }
  snippet: {
    title: string
    channelTitle: string
    thumbnails: {
      medium: {
        url: string
      }
    }
  }
}

// YouTube API レスポンス全体の型
interface YouTubeApiResponse {
  items: YouTubeSearchItem[]
  error?: {
    message: string
  }
}

// フォームから渡されるデータのバリデーション
const searchSchema = z.object({
  query: z.string().min(1),
})

export async function searchYouTube(
  formData: FormData
): Promise<{ videos?: YouTubeVideo[]; error?: string }> {
  const validatedFields = searchSchema.safeParse({
    query: formData.get('query'),
  })

  if (!validatedFields.success) {
    return { error: '検索クエリを入力してください。' }
  }

  const query = validatedFields.data.query
  const apiKey = process.env.YOUTUBE_API_KEY

  if (!apiKey) {
    return { error: 'YouTube APIキーが設定されていません。' }
  }

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=10&key=${apiKey}`

  try {
    const response = await fetch(url)
    const data: YouTubeApiResponse = await response.json()

    if (data.error) {
      console.error('YouTube API Error:', data.error.message)
      return { error: `YouTube API エラー: ${data.error.message}` }
    }

    const videos: YouTubeVideo[] = data.items
      // 1. videoId が存在しない、または null のデータを「除外」する
      .filter((item: YouTubeSearchItem) => item.id && item.id.videoId)
      // 2. 除外されなかった安全なデータだけを map で変換する
      .map((item: YouTubeSearchItem) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails.medium.url,
        channelTitle: item.snippet.channelTitle,
      }))

    return { videos }
  } catch (err: unknown) { // any ではなく unknown を使用
    console.error(err)
    if (err instanceof Error) {
      return { error: `検索中にエラーが発生しました: ${err.message}` }
    }
    return { error: '検索中に不明なエラーが発生しました。' }
  }
}

// --- ここからが saveVideo ---

// フォームから渡されるデータのバリデーション
const videoSchema = z.object({
  title: z.string(),
  youtube_video_id: z.string(),
  thumbnail_url: z.string(),
  video_type: z.enum(['original_song', 'cover', 'live_performance']),
  artist_id: z.string().uuid().optional().or(z.literal('')),
  original_song_id: z.string().uuid().optional().or(z.literal('')),
})

export async function saveVideo(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const validatedFields = videoSchema.safeParse({
    title: formData.get('title'),
    youtube_video_id: formData.get('youtube_video_id'),
    thumbnail_url: formData.get('thumbnail_url'),
    video_type: formData.get('video_type'),
    artist_id: formData.get('artist_id'),
    original_song_id: formData.get('original_song_id'),
  })

  if (!validatedFields.success) {
    console.error(validatedFields.error.flatten().fieldErrors)
    return { error: '入力データが無効です。' }
  }

  const {
    title,
    youtube_video_id,
    thumbnail_url,
    video_type,
    artist_id,
    original_song_id,
  } = validatedFields.data

  const supabase = createClient()

  try {
    const { error } = await supabase.from('videos').insert({
      title,
      youtube_video_id,
      thumbnail_url,
      video_type,
      artist_id: artist_id || null, // 空文字の場合は null をDBに保存
      original_song_id: original_song_id || null,
    })

    if (error) {
      if (error.code === '23505') { // unique_violation
        return { error: 'このYouTube動画は既に追加されています。' }
      }
      throw error
    }

    return { success: true }
  } catch (err: unknown) { // ▼▼▼【重要】any を unknown に変更 ▼▼▼
    console.error(err)
    // ▼▼▼ エラーの中身をチェックしてからメッセージを返す ▼▼▼
    if (err instanceof Error) {
      return { error: `データベースへの保存中にエラーが発生しました: ${err.message}` }
    }
    return { error: 'データベースへの保存中に不明なエラーが発生しました。' }
  }
}

// artists_v2テーブルから検索するための型
export interface ArtistSearchResult {
  id: string
  name: string
  image_url: string | null
}

export async function searchArtists(
  query: string
): Promise<{ artists?: ArtistSearchResult[]; error?: string }> {
  if (query.length < 2) {
    return { artists: [] } // 2文字未満の場合は検索しない
  }

  const supabase = createClient()
  try {
    const { data, error } = await supabase
      .from('artists_v2')
      .select('id, name, image_url')
      .ilike('name', `%${query}%`) // あいまい検索
      .limit(5) // 最大5件まで

    if (error) throw error

    return { artists: data }
  } catch (err: unknown) {
    console.error(err)
    if (err instanceof Error) {
      return { error: `アーティスト検索中にエラーが発生しました: ${err.message}` }
    }
    return { error: 'アーティスト検索中に不明なエラーが発生しました。' }
  }
}

// song_artists と artists_v2 の型を定義
interface ArtistName {
  name: string
}

// song_artists の型
interface ArtistForSong {
  artists_v2: ArtistName | null
}

// songs_v2テーブルから検索するための型
export interface SongSearchResult {
  id: string
  title: string
  image_url: string | null
  song_artists: ArtistForSong[]
}
// ▲▲▲

export async function searchSongs(
  query: string
): Promise<{ songs?: SongSearchResult[]; error?: string }> {
  if (query.length < 2) {
    return { songs: [] }
  }

  const supabase = createClient()
  try {
    const { data, error } = await supabase
      .from('songs_v2')
      .select(`
        id,
        title,
        image_url,
        song_artists (
          artists_v2 (
            name
          )
        )
      `)
      .ilike('title', `%${query}%`) // 曲名であいまい検索
      .limit(5)

    if (error) throw error

    // ここでエラーが発生していたが、型の定義を修正したので解決
    return { songs: data }
  } catch (err: unknown) {
    console.error(err)
    if (err instanceof Error) {
      return { error: `曲検索中にエラーが発生しました: ${err.message}` }
    }
    return { error: '曲検索中に不明なエラーが発生しました。' }
  }
}

// videosテーブルから検索するための型
type VideoArtistLite = { id: string | null; name: string | null }

export interface VideoSearchResult {
  id: string
  title: string
  thumbnail_url: string | null
  artists_v2: VideoArtistLite | VideoArtistLite[] | null
}

export async function searchVideos(
  query: string
): Promise<{ videos?: VideoSearchResult[]; error?: string }> {
  if (query.length < 2) {
    return { videos: [] }
  }

  const supabase = createClient()
  try {
    // videosテーブルを検索し、アーティスト名も取得
    // 「原曲」として登録されているものだけを検索
    const { data, error } = await supabase
      .from('videos')
      .select(`
        id,
        title,
        thumbnail_url,
        artists_v2 (
          id,
          name
        )
      `)
      .eq('video_type', 'original_song') // 「原曲」のみを検索対象
      .ilike('title', `%${query}%`) // 曲名であいまい検索
      .limit(5)

    if (error) throw error

    return { videos: data }
  } catch (err: unknown) {
    console.error(err)
    if (err instanceof Error) {
      return { error: `動画検索中にエラーが発生しました: ${err.message}` }
    }
    return { error: '動画検索中に不明なエラーが発生しました。' }
  }
}