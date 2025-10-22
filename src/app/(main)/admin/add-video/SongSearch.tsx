'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { searchSongs, type SongSearchResult } from './actions'
import { useDebounce } from 'use-debounce'

interface SongSearchProps {
  onSongSelect: (songId: string) => void
  value: string // 1. 「自分のID」を受け取る
}

// ... (formatArtists関数は変更なし)
const formatArtists = (artists: SongSearchResult['song_artists_test']) => {
  return artists.map(a => a.artists_test?.[0]?.name || '').join(', ')
}

export default function SongSearch({ onSongSelect, value }: SongSearchProps) {
  const [query, setQuery] = useState('') // 自分の入力テキスト
  const [debouncedQuery] = useDebounce(query, 300)
  const [results, setResults] = useState<SongSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTitle, setSelectedTitle] = useState('')

  // 2. 親から渡された「自分のID (value)」を監視する
  useEffect(() => {
    if (value === '') { // もし親が「IDをクリア」したら
      setQuery('') // 自分の入力テキストもクリアする
      setSelectedTitle('')
    }
  }, [value]) // value が変更された時だけ実行

  useEffect(() => {
    // 3. 検索ロジックは、自分の入力テキスト(query)だけを監視する
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
      const { songs } = await searchSongs(debouncedQuery)
      setResults(songs || [])
      setIsLoading(false)
    }
    loadSongs()
  }, [debouncedQuery, selectedTitle, query]) // queryが変更されたら検索

  const handleSelect = (song: SongSearchResult) => {
    const artistName = formatArtists(song.song_artists_test)
    const displayTitle = `${song.title} ${artistName ? `(${artistName})` : ''}`
    
    setQuery(displayTitle) // 自分のテキストを更新
    setSelectedTitle(displayTitle)
    onSongSelect(song.id) // 親に「IDが決定した」と通知
    setResults([])
  }

  return (
    <div className="relative">
      <label htmlFor="song_search" className="block text-sm font-medium text-gray-700">
        原曲 (Spotify) (オプショナル)
      </label>
      <input
        type="search"
        id="song_search"
        value={query} // 自分のテキストを表示
        onChange={(e) => {
          setQuery(e.target.value) // 自分のテキストを更新
          if (e.target.value !== selectedTitle) {
            setSelectedTitle('')
            onSongSelect('') // 親に「IDは未選択状態になった」と通知
          }
        }}
        placeholder="songs_test テーブルを検索..."
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
      />
      
      {/* ... (検索結果の JSX は変更なし) ... */}
      {isLoading && <p className="text-sm text-gray-500">検索中...</p>}
      {results.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
          {results.map((song) => (
            <li key={song.id} onClick={() => handleSelect(song)} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer" >
              <Image src={song.image_url || '/default-avatar.png'} alt={song.title} width={32} height={32} className="rounded-md mr-2" />
              <div>
                <p className="font-semibold">{song.title}</p>
                <p className="text-xs text-gray-500">{formatArtists(song.song_artists_test)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}