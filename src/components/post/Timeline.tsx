import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import PostCard from './PostCard'
import type { PostWithProfile, Like, SongRow, TagWithSong } from '@/types'

export default async function Timeline() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // select句を修正: tagsテーブルを経由してsongsテーブルの情報を取得
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*, profiles(nickname, user_id_text), likes(*), tags(*, songs(*))')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching posts:', error)
    return <p>投稿の読み込みに失敗しました。</p>
  }

  if (!posts || posts.length === 0) {
    return <p>まだ投稿がありません。</p>
  }

  // 取得したデータをPostCardで使いやすいように加工する
  const typedPosts: (PostWithProfile & { song: SongRow | null })[] = posts.map(
    (post) => {
      // 投稿に紐づくタグの中から、曲情報(song)を持つものを探す
      const songTag = post.tags.find((tag: TagWithSong) => tag.songs)
      const song = songTag ? songTag.songs : null

      return {
        ...post,
        profiles: post.profiles,
        likes: post.likes as Like[],
        tags: post.tags,
        // songというプロパティを追加して、PostCardで使いやすくする
        song: song,
        is_liked_by_user:
          !!user && post.likes.some((like: Like) => like.user_id === user.id),
      }
    }
  )

  return (
    <div className="w-full max-w-lg mt-8">
      {typedPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}