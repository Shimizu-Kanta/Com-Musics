'use client'

import { useState } from 'react'
import Image from 'next/image'
import { saveVideoAndCreateTag } from './videoActions'
import type { Tag } from './TagSearch'
// ▼▼▼ /admin フォルダから、完成させた検索コンポーネントをインポート ▼▼▼
import ArtistSearch from '../../app/(main)/admin/add-video/ArtistSearch'
import SongSearch from '../../app/(main)/admin/add-video/SongSearch'

// CreatePostForm から渡される一時データの型
type PendingVideoData = {
  youtube_video_id: string
  title: string
  thumbnail_url: string
  youtube_category_id: string
}

interface VideoTagModalProps {
  videoData: PendingVideoData
  onVideoTagSelect: (tag: Tag) => void
  onClose: () => void
}

export default function VideoTagModal({
  videoData,
  onVideoTagSelect,
  onClose,
}: VideoTagModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // フォームの入力値を管理
  const [videoType, setVideoType] = useState('')
  const [selectedArtistId, setSelectedArtistId] = useState('')
  const [selectedSongId, setSelectedSongId] = useState('')

  // フォーム送信
  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    setError(null)

    // 隠しフィールドと state の値を FormData に追加
    formData.set('youtube_video_id', videoData.youtube_video_id)
    formData.set('title', videoData.title)
    formData.set('thumbnail_url', videoData.thumbnail_url)
    formData.set('youtube_category_id', videoData.youtube_category_id)
    formData.set('video_type', videoType)
    formData.set('artist_id', selectedArtistId)
    formData.set('original_song_id', selectedSongId)
    
    // アクションを実行
    const result = await saveVideoAndCreateTag(formData)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else if (result.tag) {
      // 成功！「管制塔」に完成したタグを渡す
      onVideoTagSelect(result.tag)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-bold">動画の詳細情報を入力</h2>

      {/* 1. 取得した動画情報のプレビュー */}
      <div className="flex items-center space-x-4 p-2 border rounded-md bg-gray-50">
        <Image
          src={videoData.thumbnail_url}
          alt={videoData.title}
          width={80}
          height={60}
          className="rounded-md"
        />
        <div className="flex-1">
          <p className="font-semibold text-sm line-clamp-2">{videoData.title}</p>
        </div>
      </div>

      {/* 2. 動画カテゴリの選択 (必須) */}
      <div>
        <label htmlFor="video_type" className="block text-sm font-medium text-gray-700">
          動画カテゴリ (必須)
        </label>
        <select
          id="video_type"
          name="video_type"
          required
          value={videoType}
          onChange={(e) => setVideoType(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
        >
          <option value="">選択してください...</option>
          <option value="original_song">原曲</option>
          <option value="cover">歌ってみた</option>
          <option value="live_performance">ライブ映像</option>
        </select>
      </div>

      {/* 3. アーティスト検索 (必須) */}
      <ArtistSearch onArtistSelect={setSelectedArtistId} />

      {/* 4. 原曲検索 (オプショナル) */}
      {/* あなたの設計通り、原曲(YouTube)の検索は削除し、
        原曲(Spotify)の検索のみに絞っています。
      */}
      <SongSearch
        onSongSelect={handleSongSelect}
        value={selectedSongId}
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* 5. 送信ボタン */}
      <div className="flex justify-end space-x-2 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isLoading || !videoType || !selectedArtistId} // 必須項目をチェック
          className="bg-red-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
        >
          {isLoading ? '保存中...' : 'この動画をタグ付け'}
        </button>
      </div>
    </form>
  )
  
  // 原曲(Spotify)が選ばれたら、もう片方(YouTube原曲、今回は存在しない)をクリアする
  // (ロジックは /admin と同じ)
  function handleSongSelect(songId: string) {
    setSelectedSongId(songId)
    // (もし将来的にYouTube原曲検索を復活させるなら、ここでクリア処理)
  }
}