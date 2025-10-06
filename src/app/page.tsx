import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/auth/LogoutButton'

export default async function HomePage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // まず、現在のユーザー情報を取得します。
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // もしユーザーが存在しなければ、このページが表示される前に
  // ログインページへ強制的にリダイレクトします。
  if (!user) {
    redirect('/login')
  }

  // ユーザーが存在する場合のみ、プロフィールを取得してページを表示します。
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-4xl font-bold">
          ようこそ、{profile?.nickname || 'ゲスト'}さん！
        </h1>
        <p className="mt-3 text-xl">
          Com-Musicsのホームページです。
        </p>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </main>
    </div>
  )
}