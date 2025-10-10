'use client'

import { toggleFollow } from '@/app/(main)/[userId]/actions'
import { useTransition } from 'react'

type FollowButtonProps = {
  targetUserId: string
  isFollowing: boolean
}

export default function FollowButton({ targetUserId, isFollowing }: FollowButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleFollow = () => {
    startTransition(() => {
      toggleFollow(targetUserId)
    })
  }

  return (
    <button
      onClick={handleFollow}
      disabled={isPending}
      className={`px-4 py-2 text-sm font-bold rounded-full transition-colors ${
        isFollowing
          ? 'bg-white text-gray-800 border border-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
          : 'bg-black text-white hover:bg-gray-800'
      } disabled:opacity-50`}
    >
      {isPending ? '処理中...' : isFollowing ? 'フォロー中' : 'フォローする'}
    </button>
  )
}