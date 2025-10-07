import type { PostWithProfile, TagWithRelations } from '@/types'
import LikeButton from './LikeButton'
import Image from 'next/image'

// タグ一つ分を表示する小さなコンポーネント
function TagBadge({ tag }: { tag: TagWithRelations }) {
  // タグに紐づくのが曲かアーティストかを判断
  if (tag.songs) {
    const song = tag.songs
    return (
      <div className="flex items-center bg-gray-100 rounded-lg p-2 text-sm">
        {song.album_art_url && <Image src={song.album_art_url} alt={song.name || ''} width={24} height={24} className="mr-2 rounded-full"/>}
        <div>
          <span className="font-bold">{song.name}</span>
          <span className="text-gray-500 ml-2">(楽曲)</span>
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
  }
  return null
}

// PostCardが受け取るpropsの型を、PostWithProfileだけにします
export default function PostCard({ post }: { post: PostWithProfile }) {
  return (
    <div className="w-full max-w-lg p-4 mb-4 bg-white border border-gray-200 rounded-lg shadow">
      <div className="flex items-center mb-2">
        <div>
          <h3 className="font-bold text-gray-900">{post.profiles?.nickname || '名無しのユーザー'}</h3>
          <p className="text-sm text-gray-500">@{post.profiles?.user_id_text || 'unknown_user'}</p>
        </div>
      </div>
      <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>

      {/* 複数タグを表示するエリア */}
      {post.tags && post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map(tag => <TagBadge key={tag.id} tag={tag} />)}
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