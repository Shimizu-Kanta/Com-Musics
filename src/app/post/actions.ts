'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 現在のユーザー情報を取得
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to post.' }
  }

  // フォームから投稿内容を取得
  const content = formData.get('content') as string

  if (!content) {
    return { error: 'Content cannot be empty.' }
  }

  // Supabaseのpostsテーブルに新しいレコードを挿入
  const { error } = await supabase
    .from('posts')
    .insert({ content: content, user_id: user.id })

  if (error) {
    console.error('Error creating post:', error)
    return { error: 'Failed to create post.' }
  }

  // 投稿後にホームページのデータを再読み込みさせる
  revalidatePath('/')
}