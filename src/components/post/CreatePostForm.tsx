// src/components/post/CreatePostForm.tsx
'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createPost } from '@/app/(main)/post/actions'
import TagSearch, { type Tag } from './TagSearch'
import { UserCircleIcon, XCircleIcon } from '@heroicons/react/24/solid'
import type { Profile } from '@/types'

type NewPostFormProps = {
  userProfile: Profile
}

export default function NewPostForm({ userProfile }: NewPostFormProps) {
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [isTagSearchOpen, setIsTagSearchOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const handleTagSelect = (tag: Tag) => {
    if (!tags.some(t => t.id === tag.id && t.type === tag.type)) {
      setTags([...tags, tag])
    }
    setIsTagSearchOpen(false)
  }

  const removeTag = (tagToRemove: Tag) => {
    setTags(tags.filter(tag => !(tag.id === tagToRemove.id && tag.type === tagToRemove.type)))
  }

  const handleSubmit = async () => {
    if (!content.trim()) return
    await createPost(content, tags)
    setContent('')
    setTags([])
    formRef.current?.reset()
  }

  return (
    <div className="w-full max-w-lg p-4 bg-white">
      <form action={handleSubmit} ref={formRef}>
        <div className="flex justify-between items-start gap-4">
          {/* アバター */}
          {userProfile.avatar_url ? (
            <Image src={userProfile.avatar_url} alt="avatar" width={48} height={48} className="rounded-full w-12 h-12" />
          ) : (
            <UserCircleIcon className="w-12 h-12 text-gray-400" />
          )}

          {/* 入力＆操作 */}
          <div className="flex-1">
            <textarea
              name="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="いまどうしてる？"
              className="w-full p-2 text-lg border-none focus:ring-0 resize-none"
              rows={3}
            />

            {/* タグ表示 */}
            {tags.length > 0 && (
              <div className="my-2 flex flex-wrap gap-2">
                {tags.map(tag => (
                  <div key={`${tag.type}-${tag.id}`} className="flex items-center bg-gray-100 text-gray-800 text-sm font-medium pl-2.5 pr-1 py-0.5 rounded-full">
                    <span>{tag.name}</span>
                    <button type="button" onClick={() => removeTag(tag)} className="ml-1 text-gray-500 hover:text-gray-800">
                      <XCircleIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between">
              {/* ▼ ポップオーバーの基準（縮まない & 相対） */}
              <div className="relative inline-block shrink-0">
                <button
                  type="button"
                  onClick={() => setIsTagSearchOpen((v) => !v)}
                  className="text-indigo-600 hover:text-indigo-800 font-bold py-2 px-4 rounded"
                >
                  タグを追加
                </button>

                {isTagSearchOpen && (
                  // ▼ 幅と位置を固定して一列タブが収まるよう少し広め
                  <div className="absolute left-0 top-full mt-2 w-80 min-w-[20rem] max-w-[90vw] z-50">
                    <TagSearch
                      onTagSelect={handleTagSelect}
                      onClose={() => setIsTagSearchOpen(false)}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!content.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-full disabled:bg-indigo-300"
              >
                投稿する
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
