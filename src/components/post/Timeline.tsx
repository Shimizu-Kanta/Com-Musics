import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import PostCard from './PostCard'
import type { PostWithProfile, Like } from '@/types' 

export default async function Timeline() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // postsテーブルからデータを取得。
  // profilesテーブルの情報と、likesテーブルの情報を結合して取得する。
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*, profiles(nickname, user_id_text), likes(*)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching posts:', error)
    return <p>投稿の読み込みに失敗しました。</p>
  }

  if (!posts || posts.length === 0) {
    return <p>まだ投稿がありません。</p>
  }

  // 取得した投稿データに、「自分がいいねしているか」の情報を追加する
  const typedPosts: PostWithProfile[] = posts.map(post => ({
    ...post,
    // post.likes配列の中に、自分のuser.idと一致するものが1つでもあればtrue
    is_liked_by_user: !!user && post.likes.some((like: Like) => like.user_id === user.id),
  }))


  return (
    <div className="w-full max-w-lg mt-8">
      {typedPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}