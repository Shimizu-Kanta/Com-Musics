'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// (toggleAttendance関数は、live_artistsテーブルと無関係なので変更なし)
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

// ▼▼▼【重要】このcreateLive関数を、本来のシンプルな形に戻します ▼▼▼
export async function createLive(previousState: { error: string } | null, formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'ライブを登録するにはログインが必要です。' }
  }
  
  const name = formData.get('name') as string
  const artistId = formData.get('artistId') as string
  const artistName = formData.get('artistName') as string
  const artistImageUrl = formData.get('artistImageUrl') as string | null
  const venue = formData.get('venue') as string
  const date = formData.get('date') as string

  if (!name || !artistId || !artistName || !venue || !date) {
    return { error: 'すべてのフィールドを入力してください。' }
  }

  try {
    // 1. アーティスト情報を artists テーブルに登録（または更新）
    const { error: artistError } = await supabase
      .from('artists')
      .upsert({
        id: artistId,
        name: artistName,
        image_url: artistImageUrl,
      }, { onConflict: 'id' })
    if (artistError) throw artistError

    // 2. ライブ情報を lives テーブルに登録 (artist_id を含める)
    const { error: liveError } = await supabase
      .from('lives')
      .insert({
        name: name,
        venue: venue,
        live_date: date,
        created_by: user.id,
        artist_id: artistId, // artist_id を lives テーブルに直接保存
      })
    if (liveError) throw liveError

  } catch (error) {
    console.error('Create live error:', error)
    const message = error instanceof Error ? error.message : 'ライブの登録中に予期せぬエラーが発生しました。'
    return { error: message }
  }

  revalidatePath('/live')
  redirect('/live')
}