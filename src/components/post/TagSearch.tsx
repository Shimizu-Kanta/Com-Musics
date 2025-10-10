'use client'

import { searchMusic, searchArtistsAction, searchLivesAction } from '@/app/post/actions'
import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MusicalNoteIcon, PlusIcon } from '@heroicons/react/24/solid'

// 型定義は変更ありません
type TrackSearchResult = { id: string; name: string; artist: string; artistId: string; albumArtUrl?: string }
type ArtistSearchResult = { id: string; name: string; imageUrl?: string }
type LiveSearchResult = { id: string; name: string; artist: string }
type SearchResultItem = TrackSearchResult | ArtistSearchResult | LiveSearchResult

export type Tag = {
  type: 'song' | 'artist' | 'live'
  id: string
  name: string
  imageUrl?: string
  artistName?: string
  artistId?: string
}

// ▼▼▼【重要】Propsの型定義だけ、元のコードの'searchOnly'に合わせます ▼▼▼
type TagSearchProps = {
  onTagSelect: (tag: Tag) => void
  onClose: () => void
  searchOnly?: 'song' | 'artist'
}

export default function TagSearch({ onTagSelect, onClose, searchOnly }: TagSearchProps) {
  // ▼▼▼【重要】searchTypeの初期値を、searchOnlyの値に応じて設定します ▼▼▼
  const [searchType, setSearchType] = useState<'song' | 'artist' | 'live'>(searchOnly || 'song')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [isPending, startTransition] = useTransition()

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)

    startTransition(async () => {
      if (newQuery.length < 2) { setResults([]); return }
      if (searchType === 'song') { setResults(await searchMusic(newQuery)) }
      else if (searchType === 'artist') { setResults(await searchArtistsAction(newQuery)) }
      else if (searchType === 'live') { setResults(await searchLivesAction(newQuery)) }
    })
  }

  // (handleSelectとリスト表示のロジックは、あなたの元のコードのままです)
  const handleSelect = (item: SearchResultItem) => {
    if ('artistId' in item) { 
      onTagSelect({ type: 'song', id: item.id, name: item.name, artistName: item.artist, artistId: item.artistId, imageUrl: item.albumArtUrl })
    } else if ('artist' in item) { 
      onTagSelect({ type: 'live', id: item.id, name: item.name, artistName: item.artist })
    } else { 
      onTagSelect({ type: 'artist', id: item.id, name: item.name, imageUrl: item.imageUrl })
    }
    onClose()
  }

  return (
    <div className="absolute z-20 w-full p-4 bg-white border border-gray-300 rounded-lg shadow-xl top-full mt-2">
      <div className="flex items-center border-b pb-2 mb-2">
        <button type="button" onClick={onClose} className="mr-4 text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        {/* ▼▼▼【重要】searchOnlyが指定されている場合は、タブ切り替えを非表示にします ▼▼▼ */}
        {!searchOnly && (
          <div>
            <button type="button" onClick={() => setSearchType('song')} className={`px-3 py-1 text-sm rounded-full ${searchType === 'song' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>楽曲</button>
            <button type="button" onClick={() => setSearchType('artist')} className={`px-3 py-1 text-sm rounded-full ml-2 ${searchType === 'artist' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>アーティスト</button>
            <button type="button" onClick={() => setSearchType('live')} className={`px-3 py-1 text-sm rounded-full ml-2 ${searchType === 'live' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>ライブ</button>
          </div>
        )}
      </div>
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder={ searchType === 'song' ? '楽曲名で検索...' : searchType === 'artist' ? 'アーティスト名で検索...' : 'ライブ名で検索...' }
        className="w-full p-2 border border-gray-300 rounded-md"
      />
      <div className="mt-2 max-h-60 overflow-y-auto">
        {isPending && <p className="p-2 text-sm text-gray-500">検索中...</p>}

        {!isPending && results.length > 0 && (
          <ul>
            {results.map((item) => {
              if ('artistId' in item) { // Song
                return (
                  <li key={item.id} onClick={() => handleSelect(item)} className="p-2 hover:bg-gray-100 cursor-pointer flex items-center">
                    <div className="w-10 h-10 mr-3 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded">
                      {item.albumArtUrl ? <Image src={item.albumArtUrl} alt={item.name} width={40} height={40} className="rounded object-cover"/> : <MusicalNoteIcon className="w-6 h-6 text-gray-400" />}
                    </div>
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.artist}</p>
                    </div>
                  </li>
                )
              } else if ('artist' in item) { // Live
                return (
                  <li key={item.id} onClick={() => handleSelect(item)} className="p-2 hover:bg-gray-100 cursor-pointer flex items-center">
                    <div className="w-10 h-10 mr-3 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded">
                      <MusicalNoteIcon className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.artist}</p>
                    </div>
                  </li>
                )
              } else { // Artist
                return (
                  <li key={item.id} onClick={() => handleSelect(item)} className="p-2 hover:bg-gray-100 cursor-pointer flex items-center">
                    <div className="w-10 h-10 mr-3 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded">
                      {item.imageUrl ? <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded object-cover"/> : <MusicalNoteIcon className="w-6 h-6 text-gray-400" />}
                    </div>
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-sm text-gray-600">アーティスト</p>
                    </div>
                  </li>
                )
              }
            })}
          </ul>
        )}
        
        {!isPending && results.length === 0 && query.length > 1 && searchType === 'live' && (
          <div className="p-4 text-center">
            <p className="text-sm text-gray-600 mb-2">見つかりませんか？</p>
            <Link href="/live/new" className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
              <PlusIcon className="w-4 h-4 mr-2" />
              新しいライブを登録する
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}