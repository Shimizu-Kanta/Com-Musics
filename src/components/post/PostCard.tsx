import type { PostWithRelations, TagWithRelations } from '@/types' // PostWithProfile を PostWithRelations に修正
import LikeButton from './LikeButton'
import Image from 'next/image'
import Link from 'next/link'
import { TicketIcon, UserCircleIcon } from '@heroicons/react/24/solid'

function TagBadge({ tag }: { tag: TagWithRelations }) {
  if (tag.songs) {
    const song = tag.songs
    return (
      <div className="flex items-center bg-gray-100 rounded-lg p-2 text-sm">
        {song.album_art_url && <Image src={song.album_art_url} alt={song.name || ''} width={24} height={24} className="mr-2 rounded-full"/>}
        <div>
          <span className="font-bold">{song.name}</span>
          {/* artistsがnullの場合も考慮 */}
          <span className="text-gray-500 ml-2">({song.artists?.name || 'Unknown Artist'})</span>
        </div>
      </div>
    )
  } else if (tag.artists) {
    const artist = tag.artists
    return (
      <div className="flex items-center bg-gray-100 rounded-lg p-2 text-sm">
        {artist.image_url && <Image src={artist.image_url} alt={artist.name || ''} width={24} height={24} className="mr-2 rounded-full"/>}
        <div>
          <span className="font-bold">{artist.name}</span>
          <span className="text-gray-500 ml-2">(アーティスト)</span>
        </div>
      </div>
    )
  } else if (tag.lives) {
    const live = tag.lives
    return (
      <div className="flex items-center bg-gray-100 rounded-lg p-2 text-sm">
        <TicketIcon className="w-5 h-5 mr-2 text-gray-500"/>
        <div>
          <span className="font-bold">{live.name}</span>
          <span className="text-gray-500 ml-2">(ライブ)</span>
        </div>
      </div>
    )
  }
  return null
}

// ▼▼▼【ここからが今回の唯一の修正点です】▼▼▼
// PostCardが受け取るpropsの型を、PostWithRelationsに修正します
export default function PostCard({ post }: { post: PostWithRelations }) {
// ▲▲▲
  const profile = post.profiles
  if (!profile) return null

  return (
    <div className="w-full max-w-lg p-4 mb-4 bg-white border border-gray-200 rounded-lg shadow">
      <Link href={`/${profile.user_id_text}`} className="block">
        <div className="flex items-center mb-2">
          {profile.avatar_url ? (
            <Image 
              src={profile.avatar_url} 
              alt={profile.nickname || 'avatar'} 
              width={40} 
              height={40} 
              className="rounded-full mr-3"
            />
          ) : (
            <UserCircleIcon className="w-10 h-10 text-gray-400 mr-3" />
          )}
          <div>
            <h3 className="font-bold text-gray-900 hover:underline">{profile.nickname}</h3>
            <p className="text-sm text-gray-500">@{profile.user_id_text}</p>
          </div>
        </div>
      </Link>

      <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>

      {post.tags && post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag: TagWithRelations) => <TagBadge key={tag.id} tag={tag} />)}
        </div>
      )}

      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-gray-500">
          {new Date(post.created_at).toLocaleString('ja-JP')}
        </div>
        <div>
          <LikeButton post={post} />
        </div>
      </div>
    </div>
  )
}