'use client'

import { searchMusic } from '@/app/(main)/post/actions'
import { useState, useTransition } from 'react'
import Image from 'next/image'

// 検索結果の曲の型を定義
type Track = {
  id: string
  name: string
  artist: string
  artistId: string
  albumArtUrl: string
}

// 親コンポーネントに選択した曲を渡すための型
type MusicSearchProps = {
  onTrackSelect: (track: Track | null) => void
}

export default function MusicSearch({ onTrackSelect }: MusicSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [isPending, startTransition] = useTransition()

  // 検索処理
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)

    // ユーザーの入力を待ってから検索を実行
    startTransition(async () => {
      if (newQuery.length > 2) {
        const tracks = await searchMusic(newQuery)
        setResults(tracks)
      } else {
        setResults([])
      }
    })
  }

  // 曲を選択した時の処理
  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track)
    setResults([]) // 選択したら検索結果は消す
    setQuery(track.name) // 検索窓に選択した曲名を入れる
    onTrackSelect(track) // 親コンポーネントに選択した曲を伝える
  }

  // 選択を解除する処理
  const handleClearSelection = () => {
    setSelectedTrack(null)
    setQuery('')
    onTrackSelect(null)
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder="楽曲を検索してタグ付け..."
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        disabled={!!selectedTrack} // 曲を選択したら入力不可にする
      />
      {/* 選択解除ボタン */}
      {selectedTrack && (
        <button
          type="button"
          onClick={handleClearSelection}
          className="absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-500 hover:text-gray-800"
        >
          &times; {/* バツ印 */}
        </button>
      )}

      {/* 検索結果の表示 */}
      {isPending && <p className="p-2">検索中...</p>}
      {results.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((track) => (
            <li
              key={track.id}
              onClick={() => handleSelectTrack(track)}
              className="p-2 hover:bg-gray-100 cursor-pointer flex items-center"
            >
              {track.albumArtUrl && (
                <Image
                  src={track.albumArtUrl}
                  alt={track.name}
                  width={40}
                  height={40}
                  className="mr-3"
                />
              )}
              <div>
                <p className="font-bold">{track.name}</p>
                <p className="text-sm text-gray-600">{track.artist}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}