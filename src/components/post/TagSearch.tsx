'use client'

import { useEffect, useState } from 'react'
import type { Tag } from '@/app/(main)/post/actions'
import { searchMusic, searchArtists, searchLivesAction } from '@/app/(main)/post/actions'
import VideoTagModal from './VideoTagModal'

type MusicHit = { id: string; name: string; artist: string; artistId: string; albumArtUrl?: string }
type ArtistHit = { id: string; name: string; imageUrl?: string }
type LiveHit   = { id: string; name: string; venue: string | null; live_date: string | null }

const TAG_TYPES = ['artist', 'song', 'live', 'video'] as const
type TagType = typeof TAG_TYPES[number]
const toTagType = (v: string): TagType => (TAG_TYPES.includes(v as TagType) ? (v as TagType) : 'artist')

function parseYouTubeVideoId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  try {
    if (/^[A-Za-z0-9_-]{10,}$/i.test(s) && !s.includes('://')) return s
    const u = new URL(s)
    const host = u.hostname.replace(/^www\./, '')
    const path = u.pathname
    if (host === 'youtu.be') {
      const id = path.split('/').filter(Boolean)[0]
      return id || null
    }
    if (host.endsWith('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      const parts = path.split('/').filter(Boolean)
      if (parts.length >= 2) {
        const [p0, p1] = parts
        if (['shorts', 'live', 'embed', 'v'].includes(p0) && p1) return p1
      }
    }
    return null
  } catch { return null }
}

export default function TagSearch({ onTagSelect }: { onTagSelect: (t: Tag) => void }) {
  const [type, setType] = useState<TagType>('artist')
  const [query, setQuery] = useState('')
  const [music, setMusic] = useState<MusicHit[]>([])
  const [artists, setArtists] = useState<ArtistHit[]>([])
  const [lives, setLives] = useState<LiveHit[]>([])

  const [videoOpen, setVideoOpen] = useState(false)
  const [pendingVideo, setPendingVideo] = useState<{
    youtube_video_id: string
    title: string
    thumbnail_url: string
    youtube_category_id: string
  } | null>(null)

  useEffect(() => {
    let cancel = false
    async function run() {
      if (!query.trim()) { setMusic([]); setArtists([]); setLives([]); return }
      if (type === 'song') {
        const res = await searchMusic(query); if (!cancel) setMusic(res)
      } else if (type === 'artist') {
        const res = await searchArtists(query); if (!cancel) setArtists(res)
      } else if (type === 'live') {
        const res = await searchLivesAction(query); if (!cancel) setLives(res)
      }
    }
    run()
    return () => { cancel = true }
  }, [query, type])

  const pick = (t: Tag) => {
    onTagSelect(t)
    setQuery('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={type} onChange={(e) => setType(toTagType(e.target.value))} className="rounded-md border p-2">
          <option value="artist">アーティスト</option>
          <option value="song">楽曲（Spotify）</option>
          <option value="live">ライブ</option>
          <option value="video">動画（YouTube）</option>
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            type === 'artist' ? 'アーティスト名' :
            type === 'song'   ? '曲名（Spotify検索）' :
            type === 'live'   ? 'ライブ名' :
                                'YouTubeのURL を貼る'
          }
          className="flex-1 rounded-md border p-2"
        />

        {type === 'video' && (
          <button
            type="button"
            className="rounded-md bg-red-600 px-3 py-2 text-white"
            onClick={() => {
              const id = parseYouTubeVideoId(query)
              if (!id) return
              setPendingVideo({
                youtube_video_id: id,
                title: query.trim(),
                thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                youtube_category_id: '0',
              })
              setVideoOpen(true)
            }}
          >
            動画情報を取得
          </button>
        )}
      </div>

      {type === 'song' && music.length > 0 && (
        <ul className="divide-y rounded-md border">
          {music.map((m) => (
            <li key={m.id} className="flex items-center justify-between p-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.name}</p>
                <p className="truncate text-xs text-gray-500">{m.artist}</p>
              </div>
              <button
                className="rounded-md bg-gray-100 px-2 py-1 text-sm"
                onClick={() => pick({ type: 'song', id: m.id, name: m.name, imageUrl: m.albumArtUrl, artistName: m.artist })}
              >
                追加
              </button>
            </li>
          ))}
        </ul>
      )}

      {type === 'artist' && artists.length > 0 && (
        <ul className="divide-y rounded-md border">
          {artists.map((a) => (
            <li key={a.id} className="flex items-center justify-between p-2">
              <div className="min-w-0"><p className="truncate font-medium">{a.name}</p></div>
              <button className="rounded-md bg-gray-100 px-2 py-1 text-sm" onClick={() => pick({ type: 'artist', id: a.id, name: a.name, imageUrl: a.imageUrl })}>
                追加
              </button>
            </li>
          ))}
        </ul>
      )}

      {type === 'live' && lives.length > 0 && (
        <ul className="divide-y rounded-md border">
          {lives.map((lv) => (
            <li key={lv.id} className="flex items-center justify-between p-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{lv.name}</p>
                <p className="truncate text-xs text-gray-500">{lv.venue ?? ''} {lv.live_date ?? ''}</p>
              </div>
              <button className="rounded-md bg-gray-100 px-2 py-1 text-sm" onClick={() => pick({ type: 'live', id: lv.id, name: lv.name })}>
                追加
              </button>
            </li>
          ))}
        </ul>
      )}

      {videoOpen && pendingVideo && (
        <VideoTagModal
          videoData={pendingVideo}
          onVideoTagSelect={(t) => { onTagSelect(t); setVideoOpen(false); setPendingVideo(null) }}
          onClose={() => { setVideoOpen(false); setPendingVideo(null) }}
        />
      )}
    </div>
  )
}
