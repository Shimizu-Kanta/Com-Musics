'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export type TimelineType = 'all' | 'following' | 'favorite_artists_all'

export default function TimelineTabs() {
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || 'all'

  const tabs: { key: TimelineType; label: string }[] = [
    { key: 'all', label: 'すべての投稿' },
    { key: 'following', label: 'フォロー中' },
    { key: 'favorite_artists_all', label: '好きなアーティスト' },
  ]

  return (
    <div className="border-b border-gray-200 sticky top-0 bg-white z-10">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === 'all' ? '/' : `/?tab=${tab.key}`}
            className={`
              ${currentTab === tab.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
            `}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}