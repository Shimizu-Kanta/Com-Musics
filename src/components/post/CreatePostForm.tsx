'use client'

import { useState, useRef, useTransition } from 'react'
import Image from 'next/image'
import { createPost } from '@/app/(main)/post/actions'
import TagSearch, { type Tag } from './TagSearch'
import VideoTagModal from './VideoTagModal' // 詳細フォーム
import { getVideoInfo } from './videoActions' // 裏方のアクション

import { UserCircleIcon, XCircleIcon } from '@heroicons/react/24/solid'
import type { Profile } from '@/types'

type PendingVideoData = {
  youtube_video_id: string
  title: string
  thumbnail_url: string
  youtube_category_id: string
}

type NewPostFormProps = {
  userProfile: Profile
}

export default function NewPostForm({ userProfile }: NewPostFormProps) {
  const [isPending, startTransition] = useTransition()
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const formRef = useRef<HTMLFormElement>(null)

  const [isTagSearchOpen, setIsTagSearchOpen] = useState(false)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [pendingVideoData, setPendingVideoData] =
    useState<PendingVideoData | null>(null)

  const handleTagSelect = (tag: Tag) => {
    if (!tags.some((t) => t.id === tag.id && t.type === tag.type)) {
      setTags([...tags, tag])
    }
    setIsTagSearchOpen(false)
  }

  const handleVideoUrlSubmit = async (url: string) => {
    startTransition(async () => {
      setIsTagSearchOpen(false)
      const result = await getVideoInfo(url)

      if (result.error) {
        alert(result.error)
        return
      }
      if (result.data) {
        setPendingVideoData(result.data)
        setIsVideoModalOpen(true)
      } else {
        alert('動画情報の取得に失敗しました。')
      }
    })
  }

  const handleVideoTagSelect = (videoTag: Tag) => {
    if (videoTag.type !== 'video') return
    if (!tags.some((t) => t.id === videoTag.id && t.type === 'video')) {
      setTags([...tags, videoTag])
    }
    setIsVideoModalOpen(false)
    setPendingVideoData(null)
  }

  const removeTag = (tagToRemove: Tag) => {
    setTags(
      tags.filter(
        (tag) => !(tag.id === tagToRemove.id && tag.type === tagToRemove.type),
      ),
    )
  }

  const handleSubmit = async () => {
    if (!content.trim()) return
    startTransition(async () => {
      await createPost(content, tags)
      setContent('')
      setTags([])
      formRef.current?.reset()
    })
  }

  return (
    <div className="w-full max-w-lg p-4 bg-white">
      {/* ▼▼▼ 外側のフォームはここから ▼▼▼ */}
      <form action={handleSubmit} ref={formRef}>
        <div className="flex justify-between items-start gap-4">
          {/* アバター */}
          {userProfile.avatar_url ? (
            <Image
              src={userProfile.avatar_url}
              alt="avatar"
              width={48}
              height={48}
              className="rounded-full w-12 h-12"
            />
          ) : (
            <UserCircleIcon className="w-12 h-12 text-gray-400" />
          )}

          <div className="flex-1">
            {/* テキストエリア */}
            <textarea
              name="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="いまどうしてる？"
              className="w-full p-2 text-lg border-none focus:ring-0 resize-none"
              rows={3}
              maxLength={600}
            />

            {/* タグプレビュー */}
            {tags.length > 0 && (
              <div className="my-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <div
                    key={`${tag.type}-${tag.id}`}
                    className="flex items-center bg-gray-100 text-gray-800 text-sm font-medium pl-2.5 pr-1 py-0.5 rounded-full"
                  >
                    {(tag.type === 'video' ||
                      tag.type === 'song' ||
                      tag.type === 'artist') &&
                      tag.imageUrl && (
                        <Image
                          src={tag.imageUrl}
                          alt={tag.name}
                          width={20}
                          height={20}
                          className="rounded-full mr-1.5"
                        />
                      )}
                    <span>{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-gray-500 hover:text-gray-800"
                    >
                      <XCircleIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* --- ボタンエリア --- */}
            <div className="mt-2 flex items-center justify-between">
              <div className="relative inline-block shrink-0">
                <button
                  type="button"
                  onClick={() => setIsTagSearchOpen((v) => !v)}
                  className="text-indigo-600 hover:text-indigo-800 font-bold py-2 px-4 rounded"
                >
                  タグを追加
                </button>

                {/* 1. 最初のモーダル（TagSearch） */}
                {/* これは <form> の内側にあっても問題ありません */}
                {isTagSearchOpen && (
                  <div className="absolute left-0 top-full mt-2 w-80 min-w-[20rem] max-w-[90vw] z-50">
                    <TagSearch
                      onTagSelect={handleTagSelect}
                      onClose={() => setIsTagSearchOpen(false)}
                      onVideoUrlSubmit={handleVideoUrlSubmit}
                    />
                  </div>
                )}

                {/* ▼▼▼【重要】▼▼▼
                  2つ目のモーダル（VideoTagModal）は
                  <form> のネストを避けるため、
                  ここから削除されました。
                */}
              </div>

              {/* --- 投稿ボタンエリア --- */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  {content.length} / 600
                </span>
                <button
                  type="submit"
                  disabled={!content.trim() || isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-full disabled:bg-indigo-300"
                >
                  {isPending ? '投稿中...' : '投稿する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
      {/* ▲▲▲ 外側のフォームはここまで ▲▲▲ */}

      {/* ▼▼▼【重要】モーダルを<form>タグの「外」に移動しました ▼▼▼ */}
      {isVideoModalOpen && pendingVideoData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4">
            <VideoTagModal
              videoData={pendingVideoData}
              onVideoTagSelect={handleVideoTagSelect}
              onClose={() => {
                setIsVideoModalOpen(false)
                setPendingVideoData(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}