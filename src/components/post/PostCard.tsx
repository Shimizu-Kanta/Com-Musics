// src/components/post/PostCard.tsx
'use client'

import { useState } from 'react'
import type { PostWithRelations, TagWithRelations } from '@/types'
import LikeButton from './LikeButton'
import Image from 'next/image'
import Link from 'next/link'
import { UserCircleIcon, XMarkIcon } from '@heroicons/react/24/solid'
import TagComponent from './TagComponent'

// MusicLinkModal（変更なし）
function MusicLinkModal({ tag, onClose }: { tag: TagWithRelations; onClose: () => void }) {
  let searchTerm = ''
  let subText = ''

  if (tag.songs_v2) {
    const song = tag.songs_v2
    const primaryArtist = song.song_artists?.[0]?.artists_v2
    searchTerm = `${song.title || ''} ${primaryArtist?.name || ''}`
    subText = `${song.title} (${primaryArtist?.name || 'Unknown Artist'})`
  } else if (tag.artists_v2) {
    searchTerm = tag.artists_v2.name || ''
    subText = tag.artists_v2.name || ''
  }

  const encodedSearchTerm = encodeURIComponent(searchTerm.trim())
  const links = [
    { name: 'Spotify', url: `https://open.spotify.com/search/${encodedSearchTerm}` },
    { name: 'Apple Music', url: `https://music.apple.com/search?term=${encodedSearchTerm}` },
    { name: 'YouTube Music', url: `https://music.youtube.com/search?q=${encodedSearchTerm}` },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Listen on</h3>
          <button onClick={onClose}><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{subText}</p>
        <div className="space-y-2">
          {links.map(link => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg"
            >
              {link.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
};

export default function PostCard({ post }: { post: PostWithRelations }) {
  const [modalTag, setModalTag] = useState<TagWithRelations | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const profile = post.profiles
  if (!profile) return null

  const openModal = (tag: TagWithRelations) => {
    // ▼ ライブと動画はモーダル非対象（動画は外部URLを開く設計）
    if (tag.lives_v2 || tag.videos) return
    setModalTag(tag)
    setIsModalOpen(true)
  }

  return (
    <div className="w-full max-w-lg p-4 mb-4 bg-white border border-gray-200 rounded-lg shadow">
      <Link href={`/${profile.user_id_text}`} className="block">
        <div className="flex items-center mb-2">
          {/* アイコン縦長防止 */}
          <div className="relative mr-3 h-10 w-10 overflow-hidden rounded-full bg-gray-200 flex-shrink-0">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.nickname || 'avatar'}
                fill
                className="object-cover"
                sizes="40px"
              />
            ) : (
              <UserCircleIcon className="h-full w-full text-gray-400" />
            )}
          </div>

          <div>
            <h3 className="font-bold text-gray-900 hover:underline">{profile.nickname}</h3>
            <p className="text-sm text-gray-500">
              <span>@{profile.user_id_text}</span>
              <span className='mx-1'>  </span>
              <span>{formatDateTime(post.created_at)}</span>
            </p>
          </div>
        </div>
      </Link>

      <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>

      {post.tags && post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag: TagWithRelations) => (
            <TagComponent key={tag.id} tag={tag} onTagClick={openModal} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center space-x-4">
        <LikeButton post={post} />
      </div>

      {isModalOpen && modalTag && (
        <MusicLinkModal tag={modalTag} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  )
}
