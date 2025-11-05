'use client'

import { useState, useTransition } from 'react'
import { createPost, type Tag } from '@/app/(main)/post/actions'
import TagSearch from './TagSearch'
import TagComponent from './TagComponent'

export default function CreatePostForm() {
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false)

  const addTag = (t: Tag) => {
    setTags(prev => prev.some(x => x.id === t.id && x.type === t.type) ? prev : [...prev, t])
  }
  const removeTag = (idx: number) => setTags(tags.filter((_, i) => i !== idx))

  const onSubmit = () => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await createPost(content, tags)
        if (res.success) {
          setContent(''); setTags([]); setIsTagPickerOpen(false)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '投稿に失敗しました')
      }
    })
  }

  return (
    <div className="space-y-4">
      <textarea
        className="w-full rounded-md border p-2"
        rows={4}
        placeholder="いま何してる？"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      {!isTagPickerOpen ? (
        <button type="button" className="rounded-md bg-gray-100 px-3 py-2 text-sm" onClick={() => setIsTagPickerOpen(true)}>
          タグを追加
        </button>
      ) : (
        <TagSearch onTagSelect={(t) => { addTag(t); setIsTagPickerOpen(false) }} />
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t, i) => (
            <TagComponent key={`${t.type}:${t.id}`} tag={t} onRemove={() => removeTag(i)} />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
        onClick={onSubmit}
        disabled={isPending || (!content && tags.length === 0)}
      >
        {isPending ? '送信中…' : '投稿する'}
      </button>
    </div>
  )
}
