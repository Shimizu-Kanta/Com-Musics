import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import CreatePostForm from '@/components/post/CreatePostForm' // <-- これをインポート
import Timeline from '@/components/post/Timeline'

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

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-gray-50">
      <main className="flex flex-col items-center w-full flex-1 p-8">
        {/* ↓↓↓ ここに投稿フォームを配置 ↓↓↓ */}
        <CreatePostForm />

        {/* --- タイムラインは後でここに表示します --- */}
        <Suspense fallback={<p className="mt-8">読み込み中...</p>}>
          <Timeline />
        </Suspense>
      </main>
    </div>
  )
}