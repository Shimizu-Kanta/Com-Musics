'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// フォロー状態を切り替える関数
export async function toggleFollow(targetUserId: string) {
  const supabase = createClient()

  // 1. ログイン中のユーザー情報を取得
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'You must be logged in to follow.' }
  }

  // 自分自身はフォローできないようにする
  if (currentUser.id === targetUserId) {
    return { error: 'You cannot follow yourself.' }
  }

  // 2. 既にフォローしているか確認
  const { data: existingFollow } = await supabase
    .from('followers')
    .select('follower_id')
    .eq('follower_id', currentUser.id)
    .eq('following_id', targetUserId)
    .single()

  // 3. もし既にフォローしていれば、フォローを解除（削除）
  if (existingFollow) {
    await supabase
      .from('followers')
      .delete()
      .eq('follower_id', currentUser.id)
      .eq('following_id', targetUserId)
  }
  // 4. フォローしていなければ、新しくフォロー（追加）
  else {
    await supabase.from('followers').insert({
      follower_id: currentUser.id,
      following_id: targetUserId,
    })
  }

  // 5. プロフィールページを再読み込みして、変更を反映させる
  const { data: profile } = await supabase.from('profiles').select('user_id_text').eq('id', targetUserId).single()
  if (profile) {
    revalidatePath(`/${profile.user_id_text}`)
  }
}