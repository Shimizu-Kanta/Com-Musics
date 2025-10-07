'use client'

import { type LiveWithRelations } from '@/types'
import Image from 'next/image'
import { toggleAttendance } from '@/app/live/actions'
import { useTransition } from 'react'

export default function LiveCard({ live, currentUserId }: { live: LiveWithRelations; currentUserId?: string }) {
  const [isPending, startTransition] = useTransition()

  // 自分が参加しているかどうか
  const isAttending = currentUserId ? live.attended_lives.some((attendee) => attendee.user_id === currentUserId) : false
  // 参加人数
  const attendeeCount = live.attended_lives.length

  const handleAttendClick = () => {
    if (!currentUserId) {
      alert('参加するにはログインが必要です。')
      return
    }
    startTransition(() => {
      toggleAttendance(live.id)
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-4">
      <div className="flex items-start space-x-4">
        {live.artists?.image_url && (
          <Image
            src={live.artists.image_url}
            alt={live.artists.name ?? 'Artist image'}
            width={64}
            height={64}
            className="rounded-md object-cover"
          />
        )}
        <div className="flex-1">
          <p className="text-sm text-gray-500">{live.live_date}</p>
          <h2 className="text-lg font-bold">{live.name}</h2>
          {live.artists && <p className="text-md font-medium text-gray-700">{live.artists.name}</p>}
          {live.venue && <p className="text-sm text-gray-600">@{live.venue}</p>}
        </div>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <p className="text-sm text-gray-500">{attendeeCount}人が参戦</p>
        <button
          onClick={handleAttendClick}
          disabled={isPending}
          className={`px-4 py-2 text-sm font-bold rounded-full ${
            isAttending
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          } disabled:opacity-50`}
        >
          {isPending ? '処理中...' : isAttending ? '取り消し' : '参戦した！'}
        </button>
      </div>
    </div>
  )
}