'use client'

import { toggleLike } from '@/app/post/actions'
import type { PostWithProfile } from '@/types'
import { HeartIcon } from '@heroicons/react/24/outline' // いいねしてない時のアイコン
import { HeartIcon as SolidHeartIcon } from '@heroicons/react/24/solid' // いいねした時のアイコン

// いいねボタンの見た目を定義
export default function LikeButton({ post }: { post: PostWithProfile }) {
  // いいねボタンが押された時の処理
  const handleLike = async () => {
    // サーバーアクションを呼び出す
    await toggleLike(post.id)
  }

  return (
    <form action={handleLike}>
      <button
        type="submit"
        className="flex items-center space-x-1 text-gray-500 hover:text-red-500 focus:outline-none"
      >
        {post.is_liked_by_user ? (
          // いいねしている場合：赤い塗りつぶしアイコン
          <SolidHeartIcon className="w-5 h-5 text-red-500" />
        ) : (
          // いいねしていない場合：グレーの枠線アイコン
          <HeartIcon className="w-5 h-5" />
        )}
        {/* いいねの総数を表示 */}
        <span>{post.likes.length}</span>
      </button>
    </form>
  )
}