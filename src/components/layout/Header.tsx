import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import LogoutButton from '../auth/LogoutButton'
import { PlusCircleIcon } from '@heroicons/react/24/outline'

export default async function Header() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('user_id_text').eq('id', user.id).single()
    profile = data
  }

  return (
    <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            Com-Musics
          </Link>
          <nav>
            <ul className="flex items-center space-x-6">
              {user ? (
                <>
                  {/* これらのリンクはprofile情報がなくても表示できる */}
                  <li>
                    <Link href="/live" className="text-sm font-medium text-gray-700 hover:text-indigo-600">
                      ライブ一覧
                    </Link>
                  </li>
                  <li>
                    <Link href="/live/new" className="flex items-center text-sm font-medium text-gray-700 hover:text-indigo-600">
                      <PlusCircleIcon className="w-5 h-5 mr-1" />
                      ライブ登録
                    </Link>
                  </li>

                  {/* profileが存在する場合にだけ、プロフィールへのリンクを表示する */}
                  {profile && (
                    <li>
                      <Link href={`/${profile.user_id_text}`} className="text-sm font-medium text-gray-700 hover:text-indigo-600">
                        プロフィール
                      </Link>
                    </li>
                  )}

                  <li>
                    <LogoutButton />
                  </li>
                </>
              ) : (
                // ログインしていない場合の表示
                <li>
                  <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-indigo-600">
                    ログイン
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  )
}