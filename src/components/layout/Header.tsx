'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import SearchBar from '@/components/shared/SearchBar'
import LogoutButton from '@/components/auth/LogoutButton' // あなたが作ったログアウトボタンをインポート
import { HomeIcon, TicketIcon, UserCircleIcon } from '@heroicons/react/24/outline'

export default function Header() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

  // ログイン状態をリアルタイムで監視する処理
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('user_id_text').eq('id', user.id).single()
        if (profile) setProfileUserId(profile.user_id_text)
      }
    }
    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUser()
      } else {
        setProfileUserId(null)
      }
    })

    return () => subscription.unsubscribe()
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

        <nav className="flex items-center space-x-2 md:space-x-4">
          {user ? (
            // --- ログインしている時の表示 ---
            <>
              <Link href="/" className="p-2 rounded-full hover:bg-gray-100" aria-label="ホーム">
                <HomeIcon className="h-6 w-6 text-gray-600" />
              </Link>
              <Link href="/live" className="p-2 rounded-full hover:bg-gray-100" aria-label="ライブ一覧">
                <TicketIcon className="h-6 w-6 text-gray-600" />
              </Link>
              {profileUserId && (
                <Link href={`/${profileUserId}`} className="p-2 rounded-full hover:bg-gray-100" aria-label="プロフィール">
                  <UserCircleIcon className="h-6 w-6 text-gray-600" />
                </Link>
              )}
              {/* ▼▼▼【重要】LogoutButtonコンポーネントを使用します ▼▼▼ */}
              <LogoutButton />
            </>
          ) : (
            // --- ログインしていない時の表示 ---
            // ▼▼▼【重要】ログインページへのリンクに変更します ▼▼▼
            <Link 
              href="/login" 
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}