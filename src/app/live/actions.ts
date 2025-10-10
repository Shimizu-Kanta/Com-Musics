'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function toggleAttendance(liveId: number) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインが必要です。' }

  const { data: existingAttendance } = await supabase.from('attended_lives').select('id').eq('user_id', user.id).eq('live_id', liveId).single()

  if (existingAttendance) {
    const { error } = await supabase.from('attended_lives').delete().eq('id', existingAttendance.id)
    if (error) return { error: '参加の取り消しに失敗しました。' }
    revalidatePath('/live'); revalidatePath(`/${user.id}`);
    return { success: true, attended: false }
  } else {
    const { error } = await supabase.from('attended_lives').insert({ user_id: user.id, live_id: liveId })
    if (error) return { error: '参加記録の追加に失敗しました。' }
    revalidatePath('/live'); revalidatePath(`/${user.id}`);
    return { success: true, attended: true }
  }
}

// ▼▼▼ 2つのcreateLive関数を、ここに統合しました ▼▼▼
export async function createLive(previousState: { error: string } | null, formData: FormData) {
  const supabase = createClient()

  // ログインユーザーを取得
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'ライブを登録するにはログインが必要です。' }
  }
  
  // フォームからデータを取得
  const name = formData.get('name') as string
  const artistId = formData.get('artistId') as string
  const venue = formData.get('venue') as string
  const date = formData.get('date') as string

  // バリデーション
  if (!name || !artistId || !venue || !date) {
    return { error: 'すべてのフィールドを入力してください。' }
  }

  try {
    const { error: liveError } = await supabase
      .from('lives')
      .insert({
        name,
        artist_id: artistId,
        venue,
        live_date: date,
        created_by: user.id, // 登録者IDを追加
      })
    
    if (liveError) throw liveError

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '不明なエラーが発生しました。'
    return { error: `ライブの作成に失敗しました: ${message}` }
  }

  revalidatePath('/live')
  redirect('/live')
}