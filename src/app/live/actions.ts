'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// ライブへの参加・キャンセルを切り替える関数
export async function toggleAttendance(liveId: number) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  // 既に参加しているか確認
  const { data: existingAttendance } = await supabase
    .from('attended_lives')
    .select('id')
    .eq('user_id', user.id)
    .eq('live_id', liveId)
    .single()

  // 既に参加していれば、参加を取り消す
  if (existingAttendance) {
    await supabase.from('attended_lives').delete().eq('id', existingAttendance.id)
  }
  // 参加していなければ、新しく参加登録する
  else {
    await supabase.from('attended_lives').insert({ user_id: user.id, live_id: liveId })
  }

  // ページを再読み込みして表示を更新
  revalidatePath('/live')
}