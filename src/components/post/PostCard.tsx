import type { PostWithProfile } from '../../types'
import LikeButton from './LikeButton' 

// PostWithProfileという型を引数として受け取ります
export default function PostCard({ post }: { post: PostWithProfile }) {
  return (
    <div className="w-full max-w-lg p-4 mb-4 bg-white border border-gray-200 rounded-lg shadow">
      <div className="flex items-center mb-2">
        {/*
          あとでここにアバター画像などを表示します
          <img src={...} alt="avatar" className="w-10 h-10 rounded-full mr-3" />
        */}
        <div>
          <h3 className="font-bold text-gray-900">{post.profiles?.nickname || '名無しのユーザー'}</h3>
          <p className="text-sm text-gray-500">@{post.profiles?.user_id_text || 'unknown_user'}</p>
        </div>
      </div>
      <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
      <div className="mt-2 text-sm text-gray-500">
        {/* toLocaleString()で日本の日付と時刻の書式に変換 */}
        {new Date(post.created_at).toLocaleString('ja-JP')}
      </div>
      <div>
          <LikeButton post={post} />
      </div>
    </div>
  )
}