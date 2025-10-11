'use client'

import { useState } from 'react' // useStateをインポート
import { toggleLike } from '@/app/(main)/post/actions'
import type { PostWithRelations } from '@/types'
import { HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as SolidHeartIcon } from '@heroicons/react/24/solid'

export default function LikeButton({ post }: { post: PostWithRelations }) {
  // ▼▼▼【重要】ここからが今回の主な修正点です ▼▼▼

  // 1. ブラウザ側で「いいねの状態」と「いいねの数」を独自に管理します
  const [isLiked, setIsLiked] = useState(post.is_liked_by_user)
  const [likeCount, setLikeCount] = useState(post.likes.length)

  const handleLike = async () => {
    // 2. ボタンが押されたら、まずブラウザの画面だけを先に書き換えます
    setIsLiked(!isLiked)
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1)

    // 3. その後、裏側でゆっくりサーバーに実際のデータを更新しに行きます
    await toggleLike(post.id)
  }
  // ▲▲▲

  return (
    // <form>ではなく、シンプルな<button>に変更し、onClickイベントでhandleLikeを呼び出します
    <button
      onClick={handleLike}
      className="flex items-center space-x-1 text-gray-500 hover:text-red-500 focus:outline-none"
    >
      {/* 表示するアイコンと数は、ブラウザが管理している最新の状態を元にします */}
      {isLiked ? (
        <SolidHeartIcon className="w-5 h-5 text-red-500" />
      ) : (
        <HeartIcon className="w-5 h-5" />
      )}
      <span>{likeCount}</span>
    </button>
  )
}