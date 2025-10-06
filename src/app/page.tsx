import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/auth/LogoutButton'
import CreatePostForm from '@/components/post/CreatePostForm' // <-- これをインポート

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
    <div className="flex flex-col items-center w-full min-h-screen bg-gray-50">
      <header className="w-full p-4 bg-white border-b border-gray-200 flex justify-between items-center">
        <h1 className="text-xl font-bold">Com-Musics</h1>
        <div className="flex items-center space-x-4">
          <p>ようこそ、{profile?.nickname || 'ゲスト'}さん</p>
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-col items-center w-full flex-1 p-8">
        {/* ↓↓↓ ここに投稿フォームを配置 ↓↓↓ */}
        <CreatePostForm />

        {/* --- タイムラインは後でここに表示します --- */}
      </main>
    </div>
  )
}