'use client'

import { useState } from 'react'
import Image from 'next/image'
import { type YouTubeVideo, saveVideo } from './actions'
import ArtistSearch from './ArtistSearch'
import SongSearch from './SongSearch'
import VideoSearch from './VideoSearch'

interface AddVideoFormProps {
  video: YouTubeVideo
  onCancel: () => void
  onSuccess: () => void
}

export default function AddVideoForm({ video, onCancel, onSuccess }: AddVideoFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // ▼▼▼ 選択されたIDを state で管理 ▼▼▼
  const [selectedArtistId, setSelectedArtistId] = useState('')
  const [selectedSongId, setSelectedSongId] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')

  // 曲(Spotify)が選ばれたときの処理
  const handleSongSelect = (songId: string) => {
    setSelectedSongId(songId)
    // もし曲が選ばれたら、動画(YouTube)の選択はリセットする
    if (songId) {
      setSelectedVideoId('')
    }
  }

  // 動画(YouTube)が選ばれたときの処理
  const handleVideoSelect = (videoId: string) => {
    setSelectedVideoId(videoId)
    // もし動画が選ばれたら、曲(Spotify)の選択はリセットする
    if (videoId) {
      setSelectedSongId('')
    }
  }

  // フォーム送信時の処理
  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    setError(null)
    
    // state からIDを FormData に追加
    formData.set('artist_id', selectedArtistId)
    formData.set('original_song_id', selectedSongId)
    formData.set('original_video_id', selectedVideoId)
    
    const result = await saveVideo(formData)
    
    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else if (result.success) {
      onSuccess() // 親コンポーネントに成功を通知
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* 選択された動画の確認 (変更なし) */}
      <div className="flex items-center space-x-4 p-2 border rounded-md bg-gray-50">
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
        </div>
      </div>

      {/* フォームに送信するための隠しフィールド (変更なし) */}
      <input type="hidden" name="title" value={video.title} />
      <input type="hidden" name="youtube_video_id" value={video.id} />
      <input type="hidden" name="thumbnail_url" value={video.thumbnailUrl} />

      {/* --- ユーザーが入力するフィールド --- */}
      
      <div>
        <label htmlFor="video_type" className="block text-sm font-medium text-gray-700">
          動画カテゴリ (必須)
        </label>
        <select
          id="video_type"
          name="video_type"
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
        >
          <option value="">選択してください...</option>
          <option value="original_song">原曲</option>
          <option value="cover">歌ってみた</option>
          <option value="live_performance">ライブ映像</option>
        </select>
      </div>
      
      <ArtistSearch 
        onArtistSelect={(artistId) => setSelectedArtistId(artistId)}
      />
      
      <SongSearch 
        onSongSelect={handleSongSelect}
        value={selectedSongId} // SpotifyのIDを渡す
      />
      
      <VideoSearch
        onVideoSelect={handleVideoSelect}
        value={selectedVideoId} // YouTubeのIDを渡す
      />

      {error && <p className="text-red-500">{error}</p>}

      {/* --- 送信ボタン (変更なし) --- */}
      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
        >
          {isLoading ? '保存中...' : 'この動画を登録'}
        </button>
      </div>
    </form>
  )
}