'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import SearchBar from '@/components/shared/SearchBar'
import LogoutButton from '@/components/auth/LogoutButton'
import { MagnifyingGlassIcon, Bars3Icon } from '@heroicons/react/24/outline'
import { useSidebar } from '@/components/layout/SidebarContext'

export default function Header() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<User | null>(null)
  const { openMobile } = useSidebar()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUser()
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return (
    <header className="w-full bg-white border-b sticky top-0 z-20">
      {/* ▼▼▼【重要】このコンテナの最大幅を max-w-lg から max-w-6xl に変更します ▼▼▼ */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between p-4">
        <Link href="/" className="font-bold text-lg text-gray-800">
          Com-Musics
        </Link>

        {/* PCなどの広い画面 (md以上) でのみ表示される検索バー */}
        <div className="hidden md:block flex-1 mx-4">
          <SearchBar />
        </div>

        <nav className="flex items-center space-x-2 md:space-x-4">
          {/* スマホなどの狭い画面でのみ表示される検索アイコン */}
          <button
            type="button"
            onClick={openMobile}
            className="p-2 rounded-full hover:bg-gray-100 md:hidden"
            aria-label="メニュー"
          >
            <Bars3Icon className="h-6 w-6 text-gray-600" />
          </button>

          <Link href="/search" className="p-2 rounded-full hover:bg-gray-100 md:hidden" aria-label="検索">
            <MagnifyingGlassIcon className="h-6 w-6 text-gray-600" />
          </Link>

          {user ? (
            // --- ログインしている時の表示 ---
            <>
              <LogoutButton />
            </>
          ) : (
            // --- ログインしていない時の表示 ---
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