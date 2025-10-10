'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import SearchBar from '@/components/shared/SearchBar'
import { HomeIcon, TicketIcon, UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

export default function Header() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

  // ▼▼▼【重要】認証状態をリアルタイムで監視する処理を追加します ▼▼▼
  useEffect(() => {
    // ページ読み込み時に、現在のユーザー情報を取得
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('user_id_text').eq('id', user.id).single()
        if (profile) setProfileUserId(profile.user_id_text)
      }
    }
    fetchUser()

    // ログイン状態が変化（ログイン、ログアウト）した時に、userの状態を更新するリスナーを設定
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUser() // ログインしたらプロフィール情報も再取得
      } else {
        setProfileUserId(null) // ログアウトしたらプロフィール情報をクリア
      }
    })

    // コンポーネントが不要になったら、リスナーを解除
    return () => subscription.unsubscribe()
  }, [supabase])

  // ログイン処理
  const handleLogin = async () => {
    // GitHubを使ったOAuthログインを実行します。'google'などに変更可能
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: location.origin,
      },
    })
  }

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/') // トップページに移動
    router.refresh() // ページをリフレッシュしてサーバーの状態を更新
  }

  return (
    <header className="w-full bg-white border-b sticky top-0 z-20">
      <div className="w-full max-w-lg mx-auto flex items-center justify-between p-4">
        <Link href="/" className="font-bold text-lg text-gray-800">
          Com-Musics
        </Link>
        <div className="flex-1 mx-4">
          <SearchBar />
        </div>

        {/* ▼▼▼【重要】ログイン状態に応じて表示を切り替えます ▼▼▼ */}
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
              <button onClick={handleLogout} className="p-2 rounded-full hover:bg-gray-100" aria-label="ログアウト">
                <ArrowRightOnRectangleIcon className="h-6 w-6 text-gray-600" />
              </button>
            </>
          ) : (
            // --- ログインしていない時の表示 ---
            <button
              onClick={handleLogin}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              ログイン
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}