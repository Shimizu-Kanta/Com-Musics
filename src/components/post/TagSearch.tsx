'use client'

import { useEffect, useState, useTransition } from 'react'
import type { Tag } from '@/app/(main)/post/actions'
import {
  searchMusic,
  searchArtists,
  searchLivesAction,
  addArtistFromSpotify,
  addArtistFromYouTubeChannel,
  getYouTubeMetaForModal, // ★ 追加：URLから動画タイトルを取得
} from '@/app/(main)/post/actions'
import VideoTagModal from './VideoTagModal'

type MusicHit = { id: string; name: string; artist: string; artistId: string; albumArtUrl?: string }
type ArtistHit = { id: string; name: string; imageUrl?: string }
type LiveHit   = { id: string; name: string; venue: string | null; live_date: string | null }

const TAG_TYPES = ['artist', 'song', 'live', 'video'] as const
type TagType = typeof TAG_TYPES[number]
const toTagType = (v: string): TagType => (TAG_TYPES.includes(v as TagType) ? (v as TagType) : 'artist')

type ArtistSource = 'spotify' | 'youtube'

export default function TagSearch({ onTagSelect }: { onTagSelect: (t: Tag) => void }) {
  const [type, setType] = useState<TagType>('artist')
  const [query, setQuery] = useState('')

  const [music, setMusic] = useState<MusicHit[]>([])
  const [artists, setArtists] = useState<ArtistHit[]>([])
  const [lives, setLives] = useState<LiveHit[]>([])

  const [artistSource, setArtistSource] = useState<ArtistSource>('spotify')
  const [artistBusyId, setArtistBusyId] = useState<string | null>(null)
  const [artistErr, setArtistErr] = useState<string | null>(null)

  const [youTubeBusy, startYouTubeAction] = useTransition()
  const [ytError, setYtError] = useState<string | null>(null)

  // 動画モーダル
  const [videoOpen, setVideoOpen] = useState(false)
  const [pendingVideo, setPendingVideo] = useState<{
    youtube_video_id: string
    title: string
    thumbnail_url: string
    youtube_category_id: string
  } | null>(null)

  // 検索（曲／Spotifyアーティスト／ライブ）
  useEffect(() => {
    let cancel = false
    async function run() {
      if (!query.trim()) { setMusic([]); setArtists([]); setLives([]); setYtError(null); setArtistErr(null); return }
      if (type === 'song') {
        const res = await searchMusic(query); if (!cancel) setMusic(res)
      } else if (type === 'artist' && artistSource === 'spotify') {
        const res = await searchArtists(query); if (!cancel) setArtists(res)
      } else if (type === 'live') {
        const res = await searchLivesAction(query); if (!cancel) setLives(res)
      }
    }
    run()
    return () => { cancel = true }
  }, [query, type, artistSource])

  const pick = (t: Tag) => {
    onTagSelect(t)
    setQuery('')
    setArtistErr(null)
    setYtError(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(toTagType(e.target.value))}
          className="rounded-md border p-2"
        >
          <option value="artist">アーティスト</option>
          <option value="song">楽曲（Spotify）</option>
          <option value="live">ライブ</option>
          <option value="video">動画（YouTube）</option>
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            type === 'artist'
              ? artistSource === 'spotify' ? 'アーティスト名（Spotify検索）' : 'YouTubeチャンネルURL または @handle'
              : type === 'song' ? '曲名（Spotify検索）'
              : type === 'live' ? 'ライブ名'
              : 'YouTubeのURL を貼る'
          }
          className="flex-1 rounded-md border p-2"
        />

        {/* 動画: 情報取得（URL→タイトル解決） */}
        {type === 'video' && (
          <button
            type="button"
            className="rounded-md bg-red-600 px-3 py-2 text-white disabled:opacity-50"
            disabled={youTubeBusy || !query.trim()}
            onClick={() => {
              setYtError(null)
              startYouTubeAction(async () => {
                const res = await getYouTubeMetaForModal(query)
                if (!res.ok) { setYtError(res.error); return }
                setPendingVideo(res.data)
                setVideoOpen(true)
              })
            }}
          >
            動画情報を取得
          </button>
        )}
      </div>

      {/* アーティストの入力ソース切替（Spotify / YouTube） */}
      {type === 'artist' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setArtistSource('spotify')}
            className={`rounded-md px-3 py-1 text-sm border ${artistSource === 'spotify' ? 'bg-black text-white' : 'bg-white'}`}
          >
            Spotify
          </button>
          <button
            type="button"
            onClick={() => setArtistSource('youtube')}
            className={`rounded-md px-3 py-1 text-sm border ${artistSource === 'youtube' ? 'bg-black text-white' : 'bg-white'}`}
          >
            YouTube チャンネル
          </button>
        </div>
      )}

      {/* 検索結果：曲（画像付き） */}
      {type === 'song' && music.length > 0 && (
        <ul className="divide-y rounded-md border">
          {music.map((m) => (
            <li key={m.id} className="flex items-center justify-between p-2 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {m.albumArtUrl && <img src={m.albumArtUrl} alt="" className="h-8 w-8 rounded object-cover" />}
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="truncate text-xs text-gray-500">{m.artist}</p>
                </div>
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

      {/* 検索結果：アーティスト（Spotify・画像付き） */}
      {type === 'artist' && artistSource === 'spotify' && artists.length > 0 && (
        <ul className="divide-y rounded-md border">
          {artists.map((a) => (
            <li key={a.id} className="flex items-center justify-between p-2 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {a.imageUrl && <img src={a.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />}
                <p className="truncate">{a.name}</p>
              </div>
              <div className="flex items-center gap-2">
                {artistBusyId === a.id && <span className="text-xs text-gray-500">登録中…</span>}
                <button
                  className="rounded-md bg-gray-100 px-2 py-1 text-sm disabled:opacity-50"
                  disabled={artistBusyId !== null}
                  onClick={async () => {
                    setArtistErr(null)
                    setArtistBusyId(a.id)
                    const res = await addArtistFromSpotify(a.id)
                    setArtistBusyId(null)
                    if (!res.ok) { setArtistErr(res.error); return }
                    pick({ type: 'artist', id: res.id, name: res.name, imageUrl: res.imageUrl ?? undefined })
                  }}
                >
                  追加
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {artistErr && <p className="text-sm text-red-600">{artistErr}</p>}

      {/* 追加：アーティスト（YouTubeチャンネル） */}
      {type === 'artist' && artistSource === 'youtube' && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-sm text-gray-700">
            YouTube の <span className="font-medium">チャンネルURL</span> または <span className="font-medium">@handle</span> を入力してください
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={youTubeBusy || !query.trim()}
              className="rounded-md bg-red-600 px-3 py-2 text-white disabled:opacity-50"
              onClick={() => {
                setYtError(null)
                startYouTubeAction(async () => {
                  const res = await addArtistFromYouTubeChannel(query)
                  if (!res.ok) { setYtError(res.error); return }
                  pick({ type: 'artist', id: res.id, name: res.name, imageUrl: res.imageUrl ?? undefined })
                })
              }}
            >
              チャンネル情報を取得 → 追加
            </button>
            {youTubeBusy && <span className="text-sm text-gray-500">取得中…</span>}
          </div>
          {ytError && <p className="text-sm text-red-600">{ytError}</p>}
        </div>
      )}

      {/* 検索結果：ライブ */}
      {type === 'live' && lives.length > 0 && (
        <ul className="divide-y rounded-md border">
          {lives.map((lv) => (
            <li key={lv.id} className="flex items-center justify-between p-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{lv.name}</p>
                <p className="truncate text-xs text-gray-500">{lv.venue ?? ''} {lv.live_date ?? ''}</p>
              </div>
              <button
                className="rounded-md bg-gray-100 px-2 py-1 text-sm"
                onClick={() => pick({ type: 'live', id: lv.id, name: lv.name })}
              >
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
