import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import PostCard from './PostCard'
import type { PostWithProfile, Like, TagWithRelations } from '@/types'

export default async function Timeline() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // tagsに紐づくsongsとartistsの情報も一緒に取得します
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*, profiles(*), likes(*), tags(*, songs(*), artists(*))')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching posts:', error)
    return <p>投稿の読み込みに失敗しました。</p>
  }

  if (!posts || posts.length === 0) {
    return <p>まだ投稿がありません。</p>
  }

  // 取得したデータを、定義した型に当てはめます
  const typedPosts: PostWithProfile[] = posts.map((post) => ({
    ...post,
    profiles: post.profiles,
    likes: post.likes as Like[],
    tags: post.tags as TagWithRelations[],
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