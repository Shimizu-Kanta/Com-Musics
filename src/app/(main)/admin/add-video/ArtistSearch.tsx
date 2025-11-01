'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
// ▼▼▼ インポート先を videoActions.ts に変更 ▼▼▼
import {
  searchSpotifyArtists,
  getOrCreateArtist,
} from '../../../../components/post/videoActions'
import { useDebounce } from 'use-debounce'

// ▼ Spotifyの検索結果の型
type ArtistSearchResult = {
  id: string // Spotify ID
  name: string
  imageUrl?: string
}

interface ArtistSearchProps {
  onArtistSelect: (artistId: string) => void
}

export default function ArtistSearch({ onArtistSelect }: ArtistSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebounce(query, 300)
  const [results, setResults] = useState<ArtistSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedName, setSelectedName] = useState('')

  useEffect(() => {
    if (selectedName && query === selectedName) {
      setResults([])
      return
    }
    const loadArtists = async () => {
      if (debouncedQuery.length < 2) {
        setResults([])
        return
      }
      setIsLoading(true)
      // ▼▼▼ Spotify検索アクションを呼び出す ▼▼▼
      const artists = await searchSpotifyArtists(debouncedQuery)
      setResults(artists || [])
      setIsLoading(false)
    }
    loadArtists()
  }, [debouncedQuery, selectedName, query])

  // ▼▼▼【最重要】Get or Create を実行する ▼▼▼
  const handleSelect = async (artist: ArtistSearchResult) => {
    setIsLoading(true) // 選択中...

    // Spotify情報を渡して、内部DBのUUIDを取得
    const result = await getOrCreateArtist(artist)

    setIsLoading(false)

    // ▼▼▼【重要】ここが今回の修正点です ▼▼▼
    // 'error' プロパティが result オブジェクトに存在するかどうかでチェック
    if ('error' in result) {
      alert(result.error) // ユーザーにエラーを通知
      return
    }
    // ▲▲▲

    // この時点で、resultの型は { id: string; name: string; } に確定
    setQuery(result.name) // 入力欄に名前をセット (DBの名前)
    setSelectedName(result.name)
    onArtistSelect(result.id) // ★親に「内部UUID」を通知
    setResults([])
  }

  return (
    <div className="relative">
      <label
        htmlFor="artist_search"
        className="block text-sm font-medium text-gray-700"
      >
        アーティスト (必須)
      </label>
      <input
        type="search"
        id="artist_search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (e.target.value !== selectedName) {
            setSelectedName('')
            onArtistSelect('')
          }
        }}
        placeholder="Spotify でアーティストを検索..." // プレースホルダーを変更
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
      />

      {isLoading && <p className="text-sm text-gray-500">検索中...</p>}

      {results.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
          {results.map((artist) => (
            <li
              key={artist.id}
              onClick={() => handleSelect(artist)}
              className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
            >
              <Image
                src={artist.imageUrl || '/default-avatar.png'} // 'imageUrl' に変更
                alt={artist.name}
                width={32}
                height={32}
                className="rounded-full mr-2"
              />
              {artist.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}