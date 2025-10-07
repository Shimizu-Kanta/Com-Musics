import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import LiveCard from '@/components/live/LiveCard'
import { type LiveWithRelations } from '@/types'

export const revalidate = 0

export default async function LivesPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // ログイン中のユーザー情報を取得
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: lives, error } = await supabase
    .from('lives')
    .select('*, artists(name, image_url), attended_lives(user_id)')
    .order('live_date', { ascending: false, nullsFirst: false }) // nullsFirst: falseで日付未定を末尾に

  if (error) {
    console.error('Error fetching lives:', error)
    return <p>ライブ情報の読み込みに失敗しました。</p>
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">ライブ情報一覧</h1>
      <div className="space-y-4">
        {lives && lives.length > 0 ? (
          lives.map((live) => (
            <LiveCard key={live.id} live={live as LiveWithRelations} currentUserId={user?.id} />
          ))
        ) : (
          <p>まだ登録されたライブ情報がありません。</p>
        )}
      </div>
    </div>
  )
}