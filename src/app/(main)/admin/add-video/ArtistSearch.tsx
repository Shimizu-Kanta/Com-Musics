'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { searchArtists, type ArtistSearchResult } from './actions'
import { useDebounce } from 'use-debounce'

interface ArtistSearchProps {
  // 選択されたアーティストIDを親コンポーネントに渡すための関数
  onArtistSelect: (artistId: string) => void
}

export default function ArtistSearch({ onArtistSelect }: ArtistSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebounce(query, 300) // 300ms待ってから検索
  const [results, setResults] = useState<ArtistSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedName, setSelectedName] = useState('')

  useEffect(() => {
    // 選択済みの場合は検索しない
    if (selectedName && query === selectedName) {
      setResults([])
      return
    }
    
    // 検索クエリが変更されたら検索を実行
    const loadArtists = async () => {
      if (debouncedQuery.length < 2) {
        setResults([])
        return
      }
      setIsLoading(true)
      const { artists } = await searchArtists(debouncedQuery)
      setResults(artists || [])
      setIsLoading(false)
    }
    loadArtists()
  }, [debouncedQuery, selectedName, query])

  // 検索結果からアーティストがクリックされたときの処理
  const handleSelect = (artist: ArtistSearchResult) => {
    setQuery(artist.name) // 入力欄に名前をセット
    setSelectedName(artist.name) // 選択状態を記憶
    onArtistSelect(artist.id) // 親にIDを通知
    setResults([]) // 検索結果を閉じる
  }

  return (
    <div className="relative">
      <label htmlFor="artist_search" className="block text-sm font-medium text-gray-700">
        アーティスト (オプショナル)
      </label>
      <input
        type="search"
        id="artist_search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          // もしユーザーが手動で入力内容を変更したら、IDの選択をリセット
          if (e.target.value !== selectedName) {
            setSelectedName('')
            onArtistSelect('') // 親にIDが未選択であることを通知
          }
        }}
        placeholder="artists_test テーブルを検索..."
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
      />
      
      {isLoading && <p className="text-sm text-gray-500">検索中...</p>}
      
      {/* --- 検索結果ドロップダウン --- */}
      {results.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
          {results.map((artist) => (
            <li
              key={artist.id}
              onClick={() => handleSelect(artist)}
              className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
            >
              <Image
                src={artist.image_url || '/default-avatar.png'} // デフォルト画像パスは適宜変更してください
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