// src/components/post/TagComponent.tsx
import type { TagWithRelations } from '@/types'
import Image from 'next/image'
import { MusicalNoteIcon, UserCircleIcon, TicketIcon, PlayCircleIcon } from '@heroicons/react/24/solid'

type LiveWithArtist = TagWithRelations['lives'] & {
  artists: { name: string | null } | null
}

type TagComponentProps = {
  tag: TagWithRelations
  onTagClick: (tag: TagWithRelations) => void
}

export default function TagComponent({ tag, onTagClick }: TagComponentProps) {
  // 楽曲タグ
  if (tag.songs) {
    return (
      <button
        onClick={() => onTagClick(tag)}
        className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center hover:bg-blue-200 pr-3"
      >
        {tag.songs.album_art_url ? (
          <Image
            src={tag.songs.album_art_url}
            alt={tag.songs.name}
            width={24}
            height={24}
            className="rounded-full w-5 h-5 mr-1.5 object-cover"
          />
        ) : (
          <MusicalNoteIcon className="w-4 h-4 mr-1.5" />
        )}
        <span>{tag.songs.name} - {tag.songs.artists?.name || 'Unknown Artist'}</span>
      </button>
    )
  }

  // アーティストタグ
  if (tag.artists) {
    return (
      <button
        onClick={() => onTagClick(tag)}
        className="bg-purple-100 text-purple-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center hover:bg-purple-200 pr-3"
      >
        {tag.artists.image_url ? (
          <Image
            src={tag.artists.image_url}
            alt={tag.artists.name}
            width={24}
            height={24}
            className="rounded-full w-5 h-5 mr-1.5 object-cover"
          />
        ) : (
          <UserCircleIcon className="w-4 h-4 mr-1.5" />
        )}
        <span>{tag.artists.name}</span>
      </button>
    )
  }

  // ライブタグ
  if (tag.lives) {
    const live = tag.lives as LiveWithArtist
    return (
      <div className="bg-green-100 text-green-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center">
        <TicketIcon className="w-4 h-4 mr-1.5" />
        <div>
          <span className="font-bold">{live.name}</span>
          <div className="text-xs text-green-700">
            {live.artists?.name || 'アーティスト未登録'} / {live.venue} / {live.live_date}
          </div>
        </div>
      </div>
    )
  }

  // ▼▼▼ 動画タグ（新規） ▼▼▼
  if ('videos_test' in tag && tag.videos_test) {
    // 型を明示（anyは使わない）
    const v = tag.videos_test as {
      id: string
      title?: string | null
      name?: string | null
      thumbnail_url?: string | null
      url?: string | null
      platform?: string | null
    }

    const label = v.title ?? v.name ?? '動画'
    const href = v.url ?? undefined

    // 外部URLがある場合はアンカーで新規タブ、ない場合はボタン（何もしない）
    const Inner = (
      <>
        {v.thumbnail_url ? (
          <Image
            src={v.thumbnail_url}
            alt={label}
            width={24}
            height={24}
            className="rounded w-5 h-5 mr-1.5 object-cover"
          />
        ) : (
          <PlayCircleIcon className="w-4 h-4 mr-1.5" />
        )}
        <span className="max-w-[14rem] truncate">{label}</span>
      </>
    )

    return href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-red-100 text-red-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center hover:bg-red-200 pr-3"
        title={label}
      >
        {Inner}
      </a>
    ) : (
      <div
        className="bg-red-100 text-red-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center pr-3 opacity-80"
        title={label}
      >
        {Inner}
      </div>
    )
  }

  return null
}
