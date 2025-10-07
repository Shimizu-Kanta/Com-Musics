import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import NewLiveForm from '@/components/live/NewLiveForm' 

export default async function NewLivePage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // ログインしていないユーザーはホームページに追い返す
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/')
  }

  return (
    <div className="w-full max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">新しいライブ情報を登録</h1>
      {/* 作成したフォームを配置 */}
      <NewLiveForm />
    </div>
  )
}