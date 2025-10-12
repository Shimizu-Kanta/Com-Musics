// src/components/post/LikeButton.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleLike } from '@/app/(main)/post/actions'
import type { PostWithRelations } from '@/types'
import { HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as SolidHeartIcon } from '@heroicons/react/24/solid'

// toggleLike が返すかもしれない { ok: boolean, reason?: string } を判別する型ガード
function isToggleLikeResponse(x: unknown): x is { ok: boolean; reason?: string } {
  if (typeof x !== 'object' || x === null) return false
  const r = x as Record<string, unknown>
  return 'ok' in r && typeof r.ok === 'boolean'
}

export default function LikeButton({ post }: { post: PostWithRelations }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // 初期 liked を保持（サーバーの真値）
  const initialLiked = !!post.is_liked_by_user
  // 表示制御用のローカル liked（クリックで切り替え）
  const [likedLocal, setLikedLocal] = useState<boolean>(initialLiked)

  // サーバーから来た件数（真値）
  const baseCount = post.likes?.length ?? 0
  // 表示件数 = サーバー件数 + (ローカル liked と初期 liked の差分)
  const displayCount = baseCount + (Number(likedLocal) - Number(initialLiked))

  const handleLike = () => {
    if (isPending) return

    startTransition(async () => {
      // 楽観的にトグル
      setLikedLocal((prev) => !prev)

      try {
        const result = (await toggleLike(post.id)) as unknown
        if (isToggleLikeResponse(result) && result.ok === false) {
          throw new Error(result.reason ?? 'toggleLike failed')
        }
        // サーバー真値で再描画（この時、初期 liked / baseCount も更新される）
        router.refresh()
      } catch {
        // 失敗時はロールバック
        setLikedLocal((prev) => !prev)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleLike}
      disabled={isPending}
      aria-pressed={likedLocal}
      className="flex items-center space-x-1 text-gray-500 hover:text-red-500 disabled:opacity-50"
      title={likedLocal ? 'いいねを取り消す' : 'いいね'}
    >
      {likedLocal ? (
        <SolidHeartIcon className="w-5 h-5 text-red-500" />
      ) : (
        <HeartIcon className="w-5 h-5" />
      )}
      <span className="text-sm">{displayCount}</span>
    </button>
  )
}
