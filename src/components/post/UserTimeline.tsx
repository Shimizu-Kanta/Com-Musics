import { createClient } from '@/lib/supabase/server'
import PostCard from './PostCard'
import type { PostWithRelations, Like, TagWithRelations } from '@/types'

// このコンポーネントは、表示したいユーザーのID（UUID形式）を受け取ります
export default async function UserTimeline({ userId }: { userId: string }) {
  const supabase = createClient()

  const {
    data: { user: currentUser }, // ログイン中のユーザー情報をcurrentUserとして取得
  } = await supabase.auth.getUser()

  // ▼▼▼【重要】ここのselect文を修正し、タグの関連情報を全て取得します ▼▼▼
  const { data: posts, error } = await supabase
    .from('posts')
    .select(
      '*, profiles(*), likes(*), tags(*, songs(*, artists(*)), artists(*), lives(*))'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  // ▲▲▲

  if (error) {
    console.error('Error fetching user posts:', error)
    return <p className="p-4">投稿の読み込みに失敗しました。</p>
  }

  if (!posts || posts.length === 0) {
    return <p className="p-4">まだ投稿がありません。</p>
  }

  // 取得したデータを、PostCardで使える形に整える
  // (ここのロジックは変更ありません)
  const typedPosts: PostWithRelations[] = posts.map((post) => ({
    ...post,
    profiles: post.profiles,
    likes: post.likes as Like[],
    tags: post.tags as TagWithRelations[],
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