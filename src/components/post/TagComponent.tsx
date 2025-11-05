'use client'

import type { Tag } from '@/app/(main)/post/actions'

export default function TagComponent({ tag, onRemove }: { tag: Tag; onRemove: () => void }) {
  const thumb = ('imageUrl' in tag && tag.imageUrl) ? tag.imageUrl : undefined
  const label = tag.name

  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-sm">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt={label} width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <span className="inline-block h-5 w-5 rounded-full bg-gray-200" />
      )}
      <span>{label}</span>
      <button onClick={onRemove} className="text-gray-500 hover:text-gray-800" aria-label="タグを外す">×</button>
    </span>
  )
}
