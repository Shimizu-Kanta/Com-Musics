'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { searchVideos, type VideoSearchResult } from './actions'
import { getPrimaryArtistFromDirectRelation } from '@/lib/relations'
import { useDebounce } from 'use-debounce'

interface VideoSearchProps {
  onVideoSelect: (videoId: string) => void
  value: string // 1. 「自分のID」を受け取る
}

export default function VideoSearch({ onVideoSelect, value }: VideoSearchProps) {
  const [query, setQuery] = useState('') // 自分の入力テキスト
  const [debouncedQuery] = useDebounce(query, 300)
  const [results, setResults] = useState<VideoSearchResult[]>([])
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
    const loadVideos = async () => {
      if (debouncedQuery.length < 2) {
        setResults([])
        return
      }
      setIsLoading(true)
      const { videos } = await searchVideos(debouncedQuery)
      setResults(videos || [])
      setIsLoading(false)
    }
    loadVideos()
  }, [debouncedQuery, selectedTitle, query]) // queryが変更されたら検索

  const handleSelect = (video: VideoSearchResult) => {
    const artistName = getPrimaryArtistFromDirectRelation(video.artists_v2)?.name || '不明'
    const displayTitle = `${video.title} (${artistName})`
    
    setQuery(displayTitle) // 自分のテキストを更新
    setSelectedTitle(displayTitle)
    onVideoSelect(video.id) // 親に「IDが決定した」と通知
    setResults([])
  }

  return (
    <div className="relative">
      <label htmlFor="video_search" className="block text-sm font-medium text-gray-700">
        原曲 (YouTube) (オプショナル)
      </label>
      <input
        type="search"
        id="video_search"
        value={query} // 自分のテキストを表示
        onChange={(e) => {
          setQuery(e.target.value) // 自分のテキストを更新
          if (e.target.value !== selectedTitle) {
            setSelectedTitle('')
            onVideoSelect('') // 親に「IDは未選択状態になった」と通知
          }
        }}
        placeholder="videos テーブル (原曲) を検索..."
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
      />
      
      {/* ... (検索結果の JSX は変更なし) ... */}
      {isLoading && <p className="text-sm text-gray-500">検索中...</p>}
      {results.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
          {results.map((video) => {
            const primaryArtist = getPrimaryArtistFromDirectRelation(video.artists_v2)
            return (
              <li
                key={video.id}
                onClick={() => handleSelect(video)}
                className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
              >
                <Image
                  src={video.thumbnail_url || '/default-avatar.png'}
                  alt={video.title}
                  width={32}
                  height={32}
                  className="rounded-md mr-2"
                />
                <div>
                  <p className="font-semibold">{video.title}</p>
                  <p className="text-xs text-gray-500">{primaryArtist?.name || '不明'}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}