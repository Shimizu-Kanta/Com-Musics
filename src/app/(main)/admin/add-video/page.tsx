'use client'

import { useState } from 'react'
import Image from 'next/image'
import { searchYouTube, type YouTubeVideo } from './actions'

export default function AddVideoPage() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSearch = async (formData: FormData) => {
    setIsLoading(true)
    setError(null)
    setVideos([])

    const result = await searchYouTube(formData)

    if (result.error) {
      setError(result.error)
    } else if (result.videos) {
      setVideos(result.videos)
    }
    setIsLoading(false)
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">YouTube動画 登録</h1>

      {/* --- 検索フォーム --- */}
      <form action={handleSearch} className="mb-6">
        <input
          type="search"
          name="query"
          placeholder="YouTubeで動画を検索..."
          className="border rounded-md p-2 w-full mb-2"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
        >
          {isLoading ? '検索中...' : '検索'}
        </button>
      </form>

      {error && <p className="text-red-500">{error}</p>}

      {/* --- 検索結果 --- */}
      <div className="space-y-4">
        {videos.map((video) => (
          <div key={video.id} className="flex items-center space-x-4 p-2 border rounded-md">
            <Image
              src={video.thumbnailUrl}
              alt={video.title}
              width={120}
              height={90}
              className="rounded-md"
            />
            <div className="flex-1">
              <p className="font-semibold">{video.title}</p>
              <p className="text-sm text-gray-600">{video.channelTitle}</p>
              <p className="text-xs text-gray-500">ID: {video.id}</p>
            </div>
            {/* ▼▼▼ 次は、このボタンを機能させます ▼▼▼ */}
            <button className="bg-green-500 text-white px-3 py-1 rounded-md text-sm">
              選択
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}