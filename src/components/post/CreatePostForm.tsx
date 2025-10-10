'use client'

import { createPost } from '@/app/(main)/post/actions'
import { useRef, useState } from 'react'
import TagSearch, { type Tag } from './TagSearch'
import Image from 'next/image'

// 追加されたタグを表示するコンポーネント
function TagPill({ tag, onRemove }: { tag: Tag; onRemove: () => void }) {
  return (
    <div className="flex items-center bg-gray-200 rounded-full px-3 py-1 text-sm font-medium text-gray-800">
      {tag.imageUrl && <Image src={tag.imageUrl} alt={tag.name} width={20} height={20} className="mr-2 rounded-full" />}
      <span>{tag.name}</span>
      <button type="button" onClick={onRemove} className="ml-2 text-gray-500 hover:text-gray-800">&times;</button>
    </div>
  )
}

export default function CreatePostForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])

  // フォーム送信時の処理
  const handleCreatePost = async (formData: FormData) => {
    // 選択されたタグの情報をJSON形式でFormDataに追加
    formData.append('tags', JSON.stringify(selectedTags))

    await createPost(formData)

    formRef.current?.reset()
    setSelectedTags([])
  }

  // タグ選択時の処理
  const handleTagSelect = (tag: Tag) => {
    // 重複しないように追加
    if (!selectedTags.some(t => t.id === tag.id)) {
      setSelectedTags(prev => [...prev, tag])
    }
  }

  // タグ削除時の処理
  const handleRemoveTag = (tagId: string) => {
    setSelectedTags(prev => prev.filter(t => t.id !== tagId))
  }

  return (
    <form
      ref={formRef}
      action={handleCreatePost}
      className="w-full max-w-lg p-4 bg-white border border-gray-200 rounded-lg shadow"
    >
      <div className="flex flex-col space-y-4">
        {/* テキスト入力欄 */}
        <textarea
          name="content"
          placeholder="いまどうしてる？"
          rows={3}
          required
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {/* 追加されたタグの一覧 */}
        <div className="flex flex-wrap gap-2">
          {selectedTags.map(tag => (
            <TagPill key={tag.id} tag={tag} onRemove={() => handleRemoveTag(tag.id)} />
          ))}
        </div>

        {/* タグ追加ボタンと検索UI */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSearching(prev => !prev)}
            className="w-full p-2 text-left text-gray-500 border border-dashed rounded-md hover:border-indigo-500"
          >
            + タグを追加 (楽曲 / アーティスト)
          </button>
          {isSearching && (
            <TagSearch
              onTagSelect={handleTagSelect}
              onClose={() => setIsSearching(false)}
            />
          )}
        </div>

        {/* 投稿ボタン */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            投稿する
          </button>
        </div>
      </div>
    </form>
  )
}