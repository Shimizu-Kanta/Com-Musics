'use client'

import { searchMusic, searchArtistsAction } from '@/app/post/actions'
import { useState, useTransition } from 'react'
import Image from 'next/image'

// 検索結果の型定義
type TrackSearchResult = {
  id: string
  name: string
  artist: string
  artistId: string // artistIdが必須
  albumArtUrl?: string
}
type ArtistSearchResult = {
  id: string
  name: string
  imageUrl?: string
}
type SearchResultItem = TrackSearchResult | ArtistSearchResult

// 親に渡すTagの型
export type Tag = {
  type: 'song' | 'artist'
  id: string
  name: string
  imageUrl?: string
  artistName?: string
  artistId?: string // 楽曲の場合のアーティストID
}

type TagSearchProps = {
  onTagSelect: (tag: Tag) => void
  onClose: () => void
}

export default function TagSearch({ onTagSelect, onClose }: TagSearchProps) {
  const [searchType, setSearchType] = useState<'song' | 'artist'>('song')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [isPending, startTransition] = useTransition()

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)

    startTransition(async () => {
      if (newQuery.length < 2) {
        setResults([])
        return
      }
      if (searchType === 'song') {
        const tracks = await searchMusic(newQuery)
        setResults(tracks)
      } else {
        const artists = await searchArtistsAction(newQuery)
        setResults(artists)
      }
    })
  }

  const handleSelect = (item: SearchResultItem) => {
    if ('artistId' in item) {
      // item is TrackSearchResult
      onTagSelect({
        type: 'song',
        id: item.id,
        name: item.name,
        artistName: item.artist,
        artistId: item.artistId, // artistIdをセット
        imageUrl: item.albumArtUrl,
      })
    } else {
      // item is ArtistSearchResult
      onTagSelect({
        type: 'artist',
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
      })
    }
    onClose()
  }
  
  // (JSX部分は変更なし)
  return (
    <div className="absolute z-20 w-full p-4 bg-white border border-gray-300 rounded-lg shadow-xl top-full mt-2">
      <div className="flex items-center border-b pb-2 mb-2">
        <button type="button" onClick={onClose} className="mr-4 text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        <div>
          <button
            type="button"
            onClick={() => setSearchType('song')}
            className={`px-3 py-1 text-sm rounded-full ${searchType === 'song' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            楽曲
          </button>
          <button
            type="button"
            onClick={() => setSearchType('artist')}
            className={`px-3 py-1 text-sm rounded-full ml-2 ${searchType === 'artist' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            アーティスト
          </button>
        </div>
      </div>
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder={searchType === 'song' ? '楽曲名で検索...' : 'アーティスト名で検索...'}
        className="w-full p-2 border border-gray-300 rounded-md"
      />
      <div className="mt-2 max-h-60 overflow-y-auto">
        {isPending && <p>検索中...</p>}
        <ul>
          {results.map((item: SearchResultItem) => {
            if ('artist' in item) {
              return (
                <li key={item.id} onClick={() => handleSelect(item)} className="p-2 hover:bg-gray-100 cursor-pointer flex items-center">
                  {item.albumArtUrl && <Image src={item.albumArtUrl} alt={item.name} width={40} height={40} className="mr-3 rounded"/>}
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-sm text-gray-600">{item.artist}</p>
                  </div>
                </li>
              )
            } else {
              return (
                <li key={item.id} onClick={() => handleSelect(item)} className="p-2 hover:bg-gray-100 cursor-pointer flex items-center">
                  {item.imageUrl && <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="mr-3 rounded"/>}
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-sm text-gray-600">アーティスト</p>
                  </div>
                </li>
              )
            }
          })}
        </ul>
      </div>
    </div>
  )
}