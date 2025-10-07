import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import PostCard from './PostCard'
import type { PostWithProfile, Like, TagWithRelations } from '@/types'

// このコンポーネントは、表示したいユーザーのID（UUID形式）を受け取ります
export default async function UserTimeline({ userId }: { userId: string }) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user: currentUser }, // ログイン中のユーザー情報をcurrentUserとして取得
  } = await supabase.auth.getUser()

  // 投稿をデータベースから取得
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*, profiles(*), likes(*), tags(*, songs(*), artists(*))')
    .eq('user_id', userId) // .select() の後に絞り込み条件を指定
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user posts:', error)
    return <p className="p-4">投稿の読み込みに失敗しました。</p>
  }

  if (!posts || posts.length === 0) {
    return <p className="p-4">まだ投稿がありません。</p>
  }

  // 取得したデータを、PostCardで使える形に整える
  const typedPosts: PostWithProfile[] = posts.map((post) => ({
    ...post,
    profiles: post.profiles,
    likes: post.likes as Like[],
    tags: post.tags as TagWithRelations[],
    // ログイン中のユーザーが「いいね」しているかどうかの判定
    is_liked_by_user: !!currentUser && post.likes.some((like: Like) => like.user_id === currentUser.id),
  }))

  return (
    <div>
      {typedPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}