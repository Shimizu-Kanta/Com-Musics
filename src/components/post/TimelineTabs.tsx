'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client' // 作成したクライアントをインポート
import { type Artist } from '@/types'

export type TimelineType = 'all' | 'following' | 'favorite_artists_all'

export default function TimelineTabs() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || 'all'
  const selectedArtistId = searchParams.get('artistId') || 'all'

  const [favoriteArtists, setFavoriteArtists] = useState<Artist[]>([])
  
  useEffect(() => {
    const fetchFavoriteArtists = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: favArtistsData } = await supabase
          .from('favorite_artists_v2')
          .select('artists_v2(*)')
          .eq('user_id', user.id)

        const artists = favArtistsData
          ?.flatMap(item => {
            const relation = item.artists_v2
            if (!relation) return []
            return Array.isArray(relation) ? relation : [relation]
          })
          .filter(Boolean) as Artist[] | undefined
        if (artists) {
          setFavoriteArtists(artists)
        }
      }
    }
    fetchFavoriteArtists()
  }, [supabase])

  const handleArtistChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const artistId = e.target.value;
    if (artistId === 'all') {
      router.push('/?tab=favorite_artists_all')
    } else {
      router.push(`/?tab=favorite_artists_all&artistId=${artistId}`)
    }
  }

  const tabs: { key: TimelineType; label: string }[] = [
    { key: 'all', label: 'すべての投稿' },
    { key: 'following', label: 'フォロー中' },
    { key: 'favorite_artists_all', label: '好きなアーティスト' },
  ]

  return (
    <div className="border-b border-gray-200 sticky top-0 bg-white z-10 p-4">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === 'all' ? '/' : `/?tab=${tab.key}`}
            className={`
              ${currentTab === tab.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
            `}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {/* 「好きなアーティスト」タブが選択されている時だけドロップダウンを表示 */}
      {currentTab === 'favorite_artists_all' && favoriteArtists.length > 0 && (
        <div className="mt-4">
          <select 
            onChange={handleArtistChange} 
            value={selectedArtistId}
            className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
          >
            <option value="all">すべての好きなアーティスト</option>
            {favoriteArtists.map(artist => (
              <option key={artist.id} value={artist.id}>{artist.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}