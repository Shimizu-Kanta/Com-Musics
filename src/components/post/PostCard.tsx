import type { PostWithProfile, SongRow } from '@/types'
import LikeButton from './LikeButton'
import Image from 'next/image'

// 受け取るpostの型を更新
type PostCardProps = {
  post: PostWithProfile & { song: SongRow | null }
}

export default function PostCard({ post }: PostCardProps) {
  return (
    <div className="w-full max-w-lg p-4 mb-4 bg-white border border-gray-200 rounded-lg shadow">
      <div className="flex items-center mb-2">
        <div>
          <h3 className="font-bold text-gray-900">{post.profiles?.nickname || '名無しのユーザー'}</h3>
          <p className="text-sm text-gray-500">@{post.profiles?.user_id_text || 'unknown_user'}</p>
        </div>
      </div>
      <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>

      {/* post.songs を post.song に変更 */}
      {post.song && (
        <div className="mt-4 p-3 border rounded-lg flex items-center">
          {post.song.album_art_url && (
            <Image
              src={post.song.album_art_url}
              alt={post.song.name || 'album art'}
              width={50}
              height={50}
              className="mr-4 rounded"
            />
          )}
          <div>
            <p className="font-bold">{post.song.name}</p>
          </div>
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