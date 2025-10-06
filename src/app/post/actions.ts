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

export async function toggleLike(postId: number) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. 現在のユーザーを取得
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to like a post.' }
  }
  const userId = user.id

  // 2. 既にいいねしているかチェック
  const { data: existingLike, error: checkError } = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single()

  if (checkError && checkError.code !== 'PGRST116') {
    // PGRST116は「行が見つからない」エラーなので、それ以外は問題あり
    console.error('Error checking for likes:', checkError)
    return { error: 'Failed to process like.' }
  }

  // 3. いいねしていたら削除（いいね解除）、していなければ追加
  if (existingLike) {
    // いいね解除
    const { error: deleteError } = await supabase
      .from('likes')
      .delete()
      .eq('id', existingLike.id)
    if (deleteError) {
      console.error('Error unliking post:', deleteError)
      return { error: 'Failed to unlike post.' }
    }
  } else {
    // いいね追加
    const { error: insertError } = await supabase
      .from('likes')
      .insert({ post_id: postId, user_id: userId })
    if (insertError) {
      console.error('Error liking post:', insertError)
      return { error: 'Failed to like post.' }
    }
  }

  // 4. タイムラインのデータを再読み込み
  revalidatePath('/')
}