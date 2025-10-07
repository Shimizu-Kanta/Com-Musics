'use client'

import { useState } from 'react'
import { createLive } from '@/app/live/new/actions'
import TagSearch, { type Tag } from '@/components/post/TagSearch'

export default function NewLiveForm() {
  // 紐付けられたアーティストの情報を保持
  const [selectedArtist, setSelectedArtist] = useState<Tag | null>(null)
  // アーティスト検索UIの表示・非表示を管理
  const [isSearching, setIsSearching] = useState(false)

  // サーバーアクションを呼び出すクライアント側の関数
  const clientAction = async (formData: FormData) => {
    // 選択されたアーティストのIDをフォームデータに追加
    if (selectedArtist) {
      formData.append('artistId', selectedArtist.id)
    }
    const result = await createLive(formData)
    if (result?.error) {
      alert(result.error)
    } else {
      alert('ライブ情報を登録しました！')
    }
  }

  // 検索UIからアーティストが選択されたときの処理
  const handleArtistSelect = (tag: Tag) => {
    if (tag.type === 'artist') {
      setSelectedArtist(tag)
    }
    // 曲が選択された場合は何もしない（今回はアーティストのみ）
  }

  return (
    <form action={clientAction} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          ライブ・イベント名
        </label>
        <input
          type="text"
          id="name"
          name="name"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">出演アーティスト (任意)</label>
        {selectedArtist ? (
          <div className="flex items-center justify-between mt-2 p-2 bg-gray-100 rounded-md">
            <span>{selectedArtist.name}</span>
            <button
              type="button"
              onClick={() => setSelectedArtist(null)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              解除
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSearching((prev) => !prev)}
              className="w-full mt-1 p-2 text-left text-gray-500 border border-dashed rounded-md hover:border-indigo-500"
            >
              + アーティストを検索して紐付ける
            </button>
            {isSearching && (
              <TagSearch
                onTagSelect={handleArtistSelect}
                onClose={() => setIsSearching(false)}
                searchOnly="artist"
              />
            )}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="venue" className="block text-sm font-medium text-gray-700">
          会場名 (任意)
        </label>
        <input
          type="text"
          id="venue"
          name="venue"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        />
      </div>

      <div>
        <label htmlFor="live_date" className="block text-sm font-medium text-gray-700">
          開催日 (任意)
        </label>
        <input
          type="date"
          id="live_date"
          name="live_date"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-6 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          登録する
        </button>
      </div>
    </form>
  )
}