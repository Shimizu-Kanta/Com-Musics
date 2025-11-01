'use client'

import { searchMusic, searchArtistsAction, searchLivesAction } from '@/app/(main)/post/actions'
import { useState, useTransition, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MusicalNoteIcon, PlusIcon, VideoCameraIcon } from '@heroicons/react/24/solid' // VideoCameraIcon をインポート

// 型定義
type TrackSearchResult = { id: string; name: string; artist: string; artistId: string; albumArtUrl?: string }
type ArtistSearchResult = { id: string; name: string; imageUrl?: string }
type LiveSearchResult = { 
  id: string; 
  name: string; 
  venue: string | null;
  live_date: string | null;
  artists: { name: string | null } | null; 
}
type SearchResultItem = TrackSearchResult | ArtistSearchResult | LiveSearchResult

// ▼▼▼【重要】「video」タグにも対応した、最新の「Tag」の型定義です ▼▼▼
export type Tag = {
  type: 'song' | 'artist' | 'live' | 'video' // 'video' を追加
  id: string
  name: string
  imageUrl?: string
  artistName?: string
  artistId?: string
  venue?: string
  liveDate?: string
  youtube_video_id?: string // video が使用
}
// ▲▲▲

type TagSearchProps = {
  onTagSelect: (tag: Tag) => void
  onClose: () => void
  searchOnly?: 'song' | 'artist'
  // ▼▼▼【重要】親（管制塔）にURLを渡すための新しい関数 ▼▼▼
  onVideoUrlSubmit: (url: string) => void
}

export default function TagSearch({ onTagSelect, onClose, searchOnly, onVideoUrlSubmit }: TagSearchProps) {
  // ▼ 検索タイプに 'video' を追加
  const [searchType, setSearchType] = useState<'song' | 'artist' | 'live' | 'video'>(searchOnly || 'song')
  const [query, setQuery] = useState('') // 曲/アーティスト/ライブ 検索クエリ
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [isPending, startTransition] = useTransition()
  
  // ▼ 動画タブ用の state
  const [videoUrl, setVideoUrl] = useState('')

  // 検索ロジック (Debounce)
  useEffect(() => {
    // 動画タブが選択されている時は、検索ロジックを動かさない
    if (searchType === 'video') {
      setResults([])
      return
    }
    
    if (query.length < 2) {
      setResults([])
      return
    }

    const handleSearch = () => {
      startTransition(async () => {
        let searchResults: SearchResultItem[] = []
        if (searchType === 'song') {
          searchResults = await searchMusic(query)
        } else if (searchType === 'artist') {
          searchResults = await searchArtistsAction(query)
        } else if (searchType === 'live') {
          searchResults = await searchLivesAction(query)
        }
        setResults(searchResults)
      })
    }

    const timer = setTimeout(() => handleSearch(), 300)
    return () => clearTimeout(timer)

  }, [query, searchType, startTransition])


  // 検索結果から項目が選択されたときの処理
  const handleSelect = (item: SearchResultItem) => {
    if ('artistId' in item) { // Song
      onTagSelect({ type: 'song', id: item.id, name: item.name, artistName: item.artist, artistId: item.artistId, imageUrl: item.albumArtUrl })
    } else if ('venue' in item) { // Live
      onTagSelect({ type: 'live', id: item.id, name: item.name, artistName: item.artists?.name || undefined, venue: item.venue || undefined, liveDate: item.live_date || undefined })
    } else { // Artist
      onTagSelect({ type: 'artist', id: item.id, name: item.name, imageUrl: item.imageUrl })
    }
    onClose() // 選択したら閉じる
  }
  
  // ▼▼▼【重要】動画URLが送信されたときの処理 ▼▼▼
  const handleVideoSubmit = () => {
    if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
      alert('有効なYouTubeのURLを貼り付けてください。')
      return
    }
    // 親コンポーネントにURLを渡す（あとは親が交通整理する）
    onVideoUrlSubmit(videoUrl)
    // ※このコンポーネントはここでは閉じない（親が閉じる）
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-[50vh] flex flex-col">
      {/* --- 検索入力欄とタブ --- */}
      <div className="p-2 border-b">
        {/* ▼▼▼ 検索タイプが 'video' かどうかでUIを切り替える ▼▼▼ */}
        {searchType === 'video' ? (
          // 【A】動画タブが選ばれている場合
          <div className="p-2 space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              <VideoCameraIcon className="w-5 h-5 mr-1 text-red-600" />
              YouTube動画のURL
            </label>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleVideoSubmit}
              disabled={!videoUrl.trim() || isPending}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400"
            >
              {isPending ? '処理中...' : '動画情報を取得'}
            </button>
          </div>
        ) : (
          // 【B】それ以外のタブ（従来）
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              searchType === 'song' ? '曲を検索...' :
              searchType === 'artist' ? 'アーティストを検索...' :
              'ライブを検索...'
            }
            className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}
        
        {!searchOnly && (
          <div className="mt-2 flex gap-2">
            {/* 曲 */}
            <button
              type="button"
              onClick={() => setSearchType('song')}
              className={`px-3 py-1 text-sm rounded-full ${searchType === 'song' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              曲
            </button>
            {/* アーティスト */}
            <button
              type="button"
              onClick={() => setSearchType('artist')}
              className={`px-3 py-1 text-sm rounded-full ${searchType === 'artist' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              アーティスト
            </button>
            {/* ライブ */}
            <button
              type="button"
              onClick={() => setSearchType('live')}
              className={`px-3 py-1 text-sm rounded-full ${searchType === 'live' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              ライブ
            </button>
            {/* ▼▼▼ 4番目の「動画」タブボタン ▼▼▼ */}
            <button
              type="button"
              onClick={() => setSearchType('video')}
              className={`px-3 py-1 text-sm rounded-full ${searchType === 'video' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              動画
            </button>
          </div>
        )}
      </div>

      {/* --- 検索結果リスト --- */}
      {/* ▼ 検索タイプが 'video' ではない時だけ、検索結果を表示 ▼ */}
      {searchType !== 'video' && (
        <div className="flex-1 overflow-y-auto">
          {isPending && <p className="p-4 text-center text-gray-500">検索中...</p>}
          {!isPending && results.length === 0 && query.length > 1 && (
            <p className="p-4 text-center text-gray-500">
              {searchType === 'live' ? '一致するライブが見つかりません。' : '一致する結果が見つかりません。'}
            </p>
          )}
          {!isPending && results.length > 0 && (
            <ul className="divide-y divide-gray-200">
              {/* (検索結果リストのJSXは、前回提示した「エラー修正版」から変更ありません) */}
              {results.map((item) => {
                if ('artistId' in item) { // Song
                  return (
                    <li key={item.id} onClick={() => handleSelect(item)} className="p-2 hover:bg-gray-100 cursor-pointer flex items-center">
                      <div className="w-10 h-10 mr-3 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded">
                        {item.albumArtUrl ? <Image src={item.albumArtUrl} alt={item.name} width={40} height={40} className="rounded object-cover" /> : <MusicalNoteIcon className="w-6 h-6 text-gray-400" />}
                      </div>
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className="text-sm text-gray-600">{item.artist}</p>
                      </div>
                    </li>
                  )
                } else if ('venue' in item) { // Live
                  return (
                    <li key={item.id} onClick={() => handleSelect(item)} className="p-2 hover:bg-gray-100 cursor-pointer">
                      <p className="font-bold">{item.name}</p>
                      <div className="text-xs text-gray-500 pl-2">
                        <p>{item.artists?.name || 'アーティスト未登録'}</p>
                        <p>{item.venue} / {item.live_date}</p>
                      </div>
                    </li>
                  )
                } else { // Artist
                  return (
                    <li key={item.id} onClick={() => handleSelect(item)} className="p-2 hover:bg-gray-100 cursor-pointer flex items-center">
                      <div className="w-10 h-10 mr-3 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded">
                        {item.imageUrl ? <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded object-cover" /> : <MusicalNoteIcon className="w-6 h-6 text-gray-400" />}
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
          {/* (ライブ新規登録リンクも変更なし) */}
          {!isPending && results.length === 0 && query.length > 1 && searchType === 'live' && (
            <div className="p-4 text-center border-t">
              <p className="text-sm text-gray-600 mb-2">見つかりませんか？</p>
              <Link href="/live/new" className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                <PlusIcon className="w-4 h-4 mr-1" />
                新しいライブを登録
              </Link>
            </div>
          )}
        </div>
      )}
      
      {/* --- 閉じるボタン --- */}
      <button
        type="button"
        onClick={onClose}
        className="p-2 border-t text-sm text-gray-600 hover:text-indigo-600"
      >
        閉じる
      </button>
    </div>
  )
}