'use client'

import { useState, useTransition } from 'react'
import { toggleAttendance } from '@/app/(main)/live/actions' // 修正した 'toggleAttendance' をインポート
import { PlusCircleIcon, CheckCircleIcon } from '@heroicons/react/24/solid'

type AttendButtonProps = {
  liveId: number
  isInitiallyAttended: boolean
}

export default function AttendButton({ liveId, isInitiallyAttended }: AttendButtonProps) {
  const [isAttended, setIsAttended] = useState(isInitiallyAttended)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      const result = await toggleAttendance(liveId)
      if (result.error) {
        alert(result.error)
      } else if (result.success) {
        // ▼▼▼ サーバーからの結果に応じて、状態を更新します ▼▼▼
        setIsAttended(result.attended) 
      }
    })
  }

  return (
    <button onClick={handleClick} disabled={isPending} className="flex items-center space-x-1 text-sm disabled:opacity-50 transition-transform transform active:scale-95">
      {isAttended ? (
        <>
          <CheckCircleIcon className="w-5 h-5 text-green-500" />
          <span>参戦済み</span>
        </>
      ) : (
        <>
          <PlusCircleIcon className="w-5 h-5 text-indigo-500" />
          <span>参戦</span>
        </>
      )}
    </button>
  )
}