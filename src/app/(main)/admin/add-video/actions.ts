'use server'

import { z } from 'zod'

// APIのレスポンスの「型」を定義しておきます
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
    // APIレスポンスに型を適用します
    const data: YouTubeApiResponse = await response.json()

    if (data.error) {
      console.error('YouTube API Error:', data.error.message)
      return { error: `YouTube API エラー: ${data.error.message}` }
    }

    // map の item に、上で定義した型を適用します
    const videos: YouTubeVideo[] = data.items.map((item: YouTubeSearchItem) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnailUrl: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
    }))

    return { videos }
  } catch (err) {
    console.error(err)
    return { error: '検索中に不明なエラーが発生しました。' }
  }
}