'use client'

import { useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid'

// page.tsxから渡されるデータの型を定義
type Live = {
  id: number
  name: string
  live_date: string | null
  artists: { name: string | null } | null
}

type Props = {
  attendedLives: Live[]
}

export default function AttendedLivesSection({ attendedLives }: Props) {
  // 折りたたみが開いているかどうかの状態を管理 (最初は閉じている)
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="py-8">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center mb-4 px-4"
      >
        <h2 className="text-xl font-bold">参戦したライブ</h2>
        {/* 開閉状態に応じてアイコンを切り替え */}
        {isOpen ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* isOpenがtrueの場合のみ、中身を表示 */}
      {isOpen && (
        <div className="space-y-2">
          {attendedLives.length > 0 ? (
            attendedLives.map((live) => (
              <div key={live.id} className="rounded-md px-4 py-2 hover:bg-gray-50">
                <p className="text-sm text-gray-500">{live.live_date}</p>
                <h3 className="font-bold text-gray-800">{live.name}</h3>
                <p className="text-sm text-gray-600">{live.artists?.name}</p>
              </div>
            ))
          ) : (
            <p className="px-4 text-sm text-gray-500">
              まだ参戦したライブはありません。
            </p>
          )}
        </div>
      )}
    </div>
  )
}