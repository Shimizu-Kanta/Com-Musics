import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import UserTimeline from '@/components/post/UserTimeline'

type ProfilePageProps = {
  params: {
    userId: string
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { userId } = params
  
  if (!userId) {
    notFound()
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id_text', userId)
    .single()
  
  if (error || !profile) {
    notFound()
  }
  
  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-gray-50">
      <header className="w-full max-w-lg p-8 bg-white border-b border-gray-200">
        <h1 className="text-3xl font-bold">{profile.nickname}</h1>
        <p className="text-md text-gray-600 mt-1">@{profile.user_id_text}</p>
        <p className="mt-4 text-gray-800">{profile.bio || '自己紹介がありません。'}</p>
      </header>

      <main className="w-full flex-1">
        {/* ここに、このユーザーの投稿一覧（タイムライン）を後で表示します */}
        <div className="w-full max-w-lg mx-auto mt-8">
            <h2 className="text-xl font-bold px-4 mb-4">投稿一覧</h2>
            <Suspense fallback={<p className="p-4">読み込み中...</p>}>
              <UserTimeline userId={profile.id} />
            </Suspense>
        </div>
      </main>
    </div>
  )
}