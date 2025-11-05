'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Tag } from '@/app/(main)/post/actions'
import { saveVideoAndCreateTag } from './videoActions'
import MusicSearch from './MusicSearch'

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

export default function VideoTagModal({ videoData, onVideoTagSelect, onClose }: VideoTagModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [videoType, setVideoType] = useState('')
  const [artistSpotifyId, setArtistSpotifyId] = useState('')
  const [songQuery, setSongQuery] = useState('')
  const [songTrackId, setSongTrackId] = useState('')

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true); setError(null)

    formData.set('youtube_video_id', videoData.youtube_video_id)
    formData.set('title', videoData.title)
    formData.set('thumbnail_url', videoData.thumbnail_url)
    formData.set('youtube_category_id', videoData.youtube_category_id)
    formData.set('video_type', videoType)

    if (artistSpotifyId) formData.set('artistSpotifyId', artistSpotifyId)
    if (songTrackId) formData.set('songSpotifyTrackId', songTrackId)

    const result = await saveVideoAndCreateTag(formData)
    if (result.error) { setError(result.error); setIsLoading(false); return }
    if (result.tag) onVideoTagSelect(result.tag)
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-bold">動画の詳細情報</h2>

      <div className="flex items-center space-x-4 p-2 border rounded-md bg-gray-50">
        <Image src={videoData.thumbnail_url} alt={videoData.title} width={80} height={60} className="rounded-md" />
        <div className="flex-1">
          <p className="font-semibold text-sm line-clamp-2">{videoData.title}</p>
        </div>
      </div>

      <div>
        <label htmlFor="video_type" className="block text-sm font-medium text-gray-700">動画カテゴリ (必須)</label>
        <select id="video_type" name="video_type" required value={videoType} onChange={(e) => setVideoType(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
          <option value="">選択してください...</option>
          <option value="original_song">原曲</option>
          <option value="cover">歌ってみた</option>
          <option value="live_performance">ライブ映像</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Spotify アーティストID（任意）</label>
        <input className="w-full rounded-md border p-2" placeholder="22桁のIDまたはURL" value={artistSpotifyId} onChange={(e) => setArtistSpotifyId(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">楽曲（Spotify検索・任意）</label>
        <input className="w-full rounded-md border p-2" placeholder="曲名で検索" value={songQuery} onChange={(e) => setSongQuery(e.target.value)} />
        {songQuery && <MusicSearch value={songQuery} onPick={(tid) => setSongTrackId(tid)} />}
        {songTrackId && <p className="text-xs text-gray-500">選択中のトラックID: {songTrackId}</p>}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end gap-2 pt-4">
        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md">キャンセル</button>
        <button type="submit" disabled={isLoading || !videoType} className="bg-red-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400">
          {isLoading ? '保存中...' : 'この動画をタグ候補に追加'}
        </button>
      </div>
    </form>
  )
}
