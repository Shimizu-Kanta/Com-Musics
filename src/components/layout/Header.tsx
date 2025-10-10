'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SearchBar from '@/components/shared/SearchBar'
// ▼▼▼【重要】TicketIcon をインポートします ▼▼▼
import { HomeIcon, UserCircleIcon, TicketIcon } from '@heroicons/react/24/outline'

export default function Header() {
  const supabase = createClient()
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id_text')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setProfileUserId(profile.user_id_text)
        }
      }
    }
    fetchUserProfile()
  }, [supabase])

  return (
    <header className="w-full bg-white border-b sticky top-0 z-20">
      <div className="w-full max-w-lg mx-auto flex items-center justify-between p-4">
        <Link href="/" className="font-bold text-lg text-gray-800">
          Com-Musics
        </Link>
        
        <div className="flex-1 mx-4">
          <SearchBar />
        </div>

        <nav className="flex items-center space-x-4">
          <Link href="/" className="p-2 rounded-full hover:bg-gray-100" aria-label="ホーム">
            <HomeIcon className="h-6 w-6 text-gray-600" />
          </Link>

          {/* ▼▼▼【重要】ここに「ライブ一覧」へのリンクを追加します ▼▼▼ */}
          <Link href="/live" className="p-2 rounded-full hover:bg-gray-100" aria-label="ライブ一覧">
            <TicketIcon className="h-6 w-6 text-gray-600" />
          </Link>
          
          {profileUserId ? (
            <Link href={`/${profileUserId}`} className="p-2 rounded-full hover:bg-gray-100" aria-label="プロフィール">
              <UserCircleIcon className="h-6 w-6 text-gray-600" />
            </Link>
          ) : (
            <span className="p-2">
              <UserCircleIcon className="h-6 w-6 text-gray-300" />
            </span>
          )}
        </nav>
      </div>
    </header>
  )
}