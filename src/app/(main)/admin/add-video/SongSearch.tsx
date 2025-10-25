'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
// ▼▼▼ インポート先を videoActions.ts に変更 ▼▼▼
import {
  searchSpotifySongs,
  getOrCreateSong,
} from '../../../../components/post/videoActions'
import { useDebounce } from 'use-debounce'

// ▼ Spotifyの検索結果の型
type SongSearchResult = {
  id: string // Spotify ID
  name: string
  artist: string
  artistId: string // Spotify Artist ID
  albumArtUrl?: string
}

interface SongSearchProps {
  onSongSelect: (songId: string) => void
  value: string
}

export default function SongSearch({ onSongSelect, value }: SongSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebounce(query, 300)
  const [results, setResults] = useState<SongSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTitle, setSelectedTitle] = useState('')

  useEffect(() => {
    if (value === '') {
      setQuery('')
      setSelectedTitle('')
    }
  }, [value])

  useEffect(() => {
    if (selectedTitle && query === selectedTitle) {
      setResults([])
      return
    }
    const loadSongs = async () => {
      if (debouncedQuery.length < 2) {
        setResults([])
        return
      }
      setIsLoading(true)
      // ▼▼▼ Spotify検索アクションを呼び出す ▼▼▼
      const songs = await searchSpotifySongs(debouncedQuery)
      setResults(songs || [])
      setIsLoading(false)
    }
    loadSongs()
  }, [debouncedQuery, selectedTitle, query])

  // ▼▼▼【最重要】Get or Create を実行する ▼▼▼
  const handleSelect = async (song: SongSearchResult) => {
    setIsLoading(true)

    // Spotify情報を渡して、内部DBのUUIDを取得
    const result = await getOrCreateSong(song)

    setIsLoading(false)

    // ▼▼▼【重要】ここが今回の修正点です ▼▼▼
    // 'error' プロパティが result オブジェクトに存在するかどうかでチェック
    if ('error' in result) {
      alert(result.error)
      return
    }
    // ▲▲▲

    // この時点で、resultの型は { id: string; } に確定
    const displayTitle = `${song.name} (${song.artist})`
    setQuery(displayTitle)
    setSelectedTitle(displayTitle)
    onSongSelect(result.id) // ★親に「内部UUID」を通知
    setResults([])
  }

  return (
    <div className="relative">
      <label
        htmlFor="song_search"
        className="block text-sm font-medium text-gray-700"
      >
        原曲 (Spotify) (オプショナル)
      </label>
      <input
        type="search"
        id="song_search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (e.target.value !== selectedTitle) {
            setSelectedTitle('')
            onSongSelect('')
          }
        }}
        placeholder="Spotify で曲を検索..." // プレースホルダーを変更
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
      />

      {isLoading && <p className="text-sm text-gray-500">検索中...</p>}

      {results.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
          {results.map((song) => (
            <li
              key={song.id}
              onClick={() => handleSelect(song)}
              className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
            >
              <Image
                src={song.albumArtUrl || '/default-avatar.png'} // 'albumArtUrl' に変更
                alt={song.name}
                width={32}
                height={32}
                className="rounded-md mr-2"
              />
              <div>
                <p className="font-semibold">{song.name}</p>
                <p className="text-xs text-gray-500">{song.artist}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}