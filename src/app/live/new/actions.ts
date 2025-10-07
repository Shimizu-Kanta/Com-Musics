'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createLive(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // ログインユーザーを取得
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be logged in.' }
  }

  // フォームからデータを取得
  const name = formData.get('name') as string
  const artistId = (formData.get('artistId') as string) || null // artistIdが空ならnull
  const venue = (formData.get('venue') as string) || null
  const liveDate = (formData.get('live_date') as string) || null

  // バリデーション
  if (!name) {
    return { error: 'ライブ名は必須です。' }
  }

  // livesテーブルにデータを挿入
  const { error } = await supabase.from('lives').insert({
    name,
    artist_id: artistId,
    venue,
    live_date: liveDate,
    created_by: user.id, // 登録者ID
  })

  if (error) {
    console.error('Error creating live:', error)
    return { error: 'ライブ情報の登録に失敗しました。' }
  }

  // キャッシュをクリアしてトップページを再読み込み
  revalidatePath('/')
  // 登録後はトップページにリダイレクト
  redirect('/')
}