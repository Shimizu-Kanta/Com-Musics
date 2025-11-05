'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import type { Tag } from '@/app/(main)/post/actions'
import { saveVideoAndCreateTag, addSongFromSpotify } from './videoActions'
import { searchArtists, addArtistFromSpotify, addArtistFromYouTubeChannel, searchMusic } from '@/app/(main)/post/actions'

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

type ArtistSource = 'spotify' | 'youtube'
type ArtistHit = { id: string; name: string; imageUrl?: string }
type SelectedArtist = { id: string; name: string }

type SongHit = { id: string; name: string; artist: string; albumArtUrl?: string }
type SelectedSong = { id: string; name: string }

export default function VideoTagModal({ videoData, onVideoTagSelect, onClose }: VideoTagModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [videoType, setVideoType] = useState('')

  // アーティスト（複数）
  const [artistSource, setArtistSource] = useState<ArtistSource>('spotify')
  const [selectedArtists, setSelectedArtists] = useState<SelectedArtist[]>([])
  const [artistQuery, setArtistQuery] = useState('')
  const [artistResults, setArtistResults] = useState<ArtistHit[]>([])
  const [artistSearchPending, startArtistSearch] = useTransition()
  const [artistAddPendingId, setArtistAddPendingId] = useState<string | null>(null)
  const [artistErr, setArtistErr] = useState<string | null>(null)
  const [ytInput, setYtInput] = useState('')
  const [ytBusy, startYtAdd] = useTransition()
  const [ytErr, setYtErr] = useState<string | null>(null)

  // 楽曲（複数）
  const [selectedSongs, setSelectedSongs] = useState<SelectedSong[]>([])
  const [songQuery, setSongQuery] = useState('')
  const [songResults, setSongResults] = useState<SongHit[]>([])
  const [songSearchPending, startSongSearch] = useTransition()
  const [songAddPendingId, setSongAddPendingId] = useState<string | null>(null)
  const [songErr, setSongErr] = useState<string | null>(null)

  const runArtistSearch = () => {
    setArtistErr(null)
    if (!artistQuery.trim()) { setArtistResults([]); return }
    startArtistSearch(async () => {
      const res = await searchArtists(artistQuery.trim())
      setArtistResults(res)
    })
  }

  const runSongSearch = () => {
    setSongErr(null)
    if (!songQuery.trim()) { setSongResults([]); return }
    startSongSearch(async () => {
      const res = await searchMusic(songQuery.trim())
      setSongResults(res)
    })
  }

  const addArtistFromSpotifyResult = async (hit: ArtistHit) => {
    setArtistErr(null)
    setArtistAddPendingId(hit.id)
    const res = await addArtistFromSpotify(hit.id)
    setArtistAddPendingId(null)
    if (!res.ok) { setArtistErr(res.error); return }
    setSelectedArtists(prev => prev.some(a => a.id === res.id) ? prev : [...prev, { id: res.id, name: res.name }])
    setArtistQuery(''); setArtistResults([])
  }

  const addArtistFromYouTube = () => {
    setYtErr(null)
    if (!ytInput.trim()) return
    startYtAdd(async () => {
      const res = await addArtistFromYouTubeChannel(ytInput.trim())
      if (!res.ok) { setYtErr(res.error); return }
      setSelectedArtists(prev => prev.some(a => a.id === res.id) ? prev : [...prev, { id: res.id, name: res.name }])
      setYtInput('')
    })
  }

  const addSongFromSpotifyResult = async (hit: SongHit) => {
    setSongErr(null)
    setSongAddPendingId(hit.id)
    const res = await addSongFromSpotify(hit.id)
    setSongAddPendingId(null)
    if (!res.ok) { setSongErr(res.error); return }
    setSelectedSongs(prev => prev.some(s => s.id === res.id) ? prev : [...prev, { id: res.id, name: res.title }])
    setSongQuery(''); setSongResults([])
  }

  const removeSelectedArtist = (id: string) => setSelectedArtists(prev => prev.filter(a => a.id !== id))
  const removeSelectedSong = (id: string) => setSelectedSongs(prev => prev.filter(s => s.id !== id))

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true); setError(null)
    formData.set('youtube_video_id', videoData.youtube_video_id)
    formData.set('title', videoData.title)
    formData.set('thumbnail_url', videoData.thumbnail_url)
    formData.set('youtube_category_id', videoData.youtube_category_id)
    formData.set('video_type', videoType)
    for (const a of selectedArtists) formData.append('artistIds', a.id)
    for (const s of selectedSongs) formData.append('songIds', s.id)

    const result = await saveVideoAndCreateTag(formData)
    if (result.error) { setError(result.error); setIsLoading(false); return }
    if (result.tag) onVideoTagSelect(result.tag)
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <h2 className="text-lg font-bold">動画の詳細情報</h2>

      <div className="flex items-center space-x-4 p-2 border rounded-md bg-gray-50">
        <Image src={videoData.thumbnail_url} alt={videoData.title} width={80} height={60} className="rounded-md" />
        <div className="flex-1">
          <p className="font-semibold text-sm line-clamp-2">{videoData.title}</p>
          {/* 以前の「URL/ID表示」は廃止し、タイトルのみ表示 */}
        </div>
      </div>

      {/* 動画タイプ（必須） */}
      <div>
        <label htmlFor="video_type" className="block text-sm font-medium text-gray-700">動画カテゴリ (必須)</label>
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

      {/* アーティスト（複数） */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">アーティスト（任意・複数可）</span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => { setArtistSource('spotify'); setArtistErr(null); setYtErr(null) }}
              className={`rounded-md px-3 py-1 text-sm border ${artistSource === 'spotify' ? 'bg-black text-white' : 'bg-white'}`}>
              Spotify 検索
            </button>
            <button type="button" onClick={() => { setArtistSource('youtube'); setArtistErr(null); setYtErr(null) }}
              className={`rounded-md px-3 py-1 text-sm border ${artistSource === 'youtube' ? 'bg-black text-white' : 'bg-white'}`}>
              YouTube チャンネル
            </button>
          </div>
        </div>

        {artistSource === 'spotify' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className="w-full rounded-md border p-2" placeholder="アーティスト名で検索" value={artistQuery} onChange={(e) => setArtistQuery(e.target.value)} />
              <button type="button" onClick={runArtistSearch} className="rounded-md bg-gray-100 px-3 py-2 text-sm" disabled={artistSearchPending || !artistQuery.trim()}>
                {artistSearchPending ? '検索中…' : '検索'}
              </button>
            </div>
            {artistResults.length > 0 && (
              <ul className="divide-y rounded-md border">
                {artistResults.map((a) => (
                  <li key={a.id} className="flex items-center justify-between p-2 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {a.imageUrl && <img src={a.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />}
                      <p className="truncate">{a.name}</p>
                    </div>
                    <button type="button" onClick={() => void addArtistFromSpotifyResult(a)}
                      className="rounded-md bg-gray-100 px-2 py-1 text-sm disabled:opacity-50" disabled={artistAddPendingId !== null}>
                      {artistAddPendingId === a.id ? '追加中…' : '追加'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {artistErr && <p className="text-sm text-red-600">{artistErr}</p>}
          </div>
        )}

        {artistSource === 'youtube' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className="w-full rounded-md border p-2" placeholder="チャンネルURL / @handle / channelId (UC...)" value={ytInput} onChange={(e) => setYtInput(e.target.value)} />
              <button type="button" onClick={addArtistFromYouTube} className="rounded-md bg-red-600 px-3 py-2 text-white disabled:opacity-50" disabled={ytBusy || !ytInput.trim()}>
                {ytBusy ? '取得中…' : '取得 → 追加'}
              </button>
            </div>
            {ytErr && <p className="text-sm text-red-600">{ytErr}</p>}
          </div>
        )}

        {selectedArtists.length > 0 && (
          <div className="rounded-md border p-2">
            <p className="text-xs text-gray-500 mb-1">選択済みアーティスト</p>
            <ul className="flex flex-wrap gap-2">
              {selectedArtists.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  <span className="truncate max-w-[12rem]">{a.name}</span>
                  <button type="button" onClick={() => removeSelectedArtist(a.id)} className="text-gray-500 hover:text-black">×</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 楽曲（複数） */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">楽曲（Spotify・任意・複数可）</span>
        </div>

        <div className="flex gap-2">
          <input className="w-full rounded-md border p-2" placeholder="曲名で検索（Spotify）" value={songQuery} onChange={(e) => setSongQuery(e.target.value)} />
          <button type="button" onClick={runSongSearch} className="rounded-md bg-gray-100 px-3 py-2 text-sm" disabled={songSearchPending || !songQuery.trim()}>
            {songSearchPending ? '検索中…' : '検索'}
          </button>
        </div>

        {songResults.length > 0 && (
          <ul className="divide-y rounded-md border">
            {songResults.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-2 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {s.albumArtUrl && <img src={s.albumArtUrl} alt="" className="h-8 w-8 rounded object-cover" />}
                  <div className="min-w-0">
                    <p className="truncate">{s.name}</p>
                    <p className="truncate text-xs text-gray-500">/ {s.artist}</p>
                  </div>
                </div>
                <button type="button" onClick={() => void addSongFromSpotifyResult(s)}
                  className="rounded-md bg-gray-100 px-2 py-1 text-sm disabled:opacity-50" disabled={songAddPendingId !== null}>
                  {songAddPendingId === s.id ? '追加中…' : '追加'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {songErr && <p className="text-sm text-red-600">{songErr}</p>}

        {selectedSongs.length > 0 && (
          <div className="rounded-md border p-2">
            <p className="text-xs text-gray-500 mb-1">選択済み楽曲</p>
            <ul className="flex flex-wrap gap-2">
              {selectedSongs.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  <span className="truncate max-w-[14rem]">{s.name}</span>
                  <button type="button" onClick={() => removeSelectedSong(s.id)} className="text-gray-500 hover:text-black">×</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md">キャンセル</button>
        <button type="submit" disabled={isLoading || !videoType} className="bg-red-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400">
          {isLoading ? '保存中...' : 'この動画をタグ候補に追加'}
        </button>
      </div>
    </form>
  )
}
