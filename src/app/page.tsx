import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations } from '@/types'
import PostCard from '@/components/post/PostCard'
import TimelineTabs from '@/components/post/TimelineTabs'

type HomePageProps = {
  searchParams: {
    tab?: string
  }
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const type = searchParams.tab || 'all'

  let posts: PostWithRelations[] = []
  let errorMessage: string | null = null

  if (type === 'all') {
    const { data: allPosts } = await supabase
      .from('posts')
      .select('*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*))')
      .order('created_at', { ascending: false }).limit(50)
    posts = allPosts || []
  } 
  else if (type === 'following') {
    if (!user) {
      errorMessage = 'フォロー中の人の投稿を見るには、ログインが必要です。'
    } else {
      const { data: followingData } = await supabase.from('followers').select('following_id').eq('follower_id', user.id)
      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map(f => f.following_id)
        const { data: followingPosts } = await supabase
          .from('posts')
          .select('*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*))')
          .in('user_id', followingIds).order('created_at', { ascending: false }).limit(50)
        posts = followingPosts || []
      }
    }
  } 
  else if (type === 'favorite_artists_all') {
    if (!user) {
      errorMessage = '好きなアーティストの投稿を見るには、ログインが必要です。'
    } else {
      const { data: favArtistsData } = await supabase.from('favorite_artists').select('artist_id').eq('user_id', user.id)
      if (favArtistsData && favArtistsData.length > 0) {
        const favArtistIds = favArtistsData.map(fa => fa.artist_id)
        const { data: tagData } = await supabase.from('tags').select('id').in('artist_id', favArtistIds)
        if (tagData && tagData.length > 0) {
          const tagIds = tagData.map(t => t.id)
          const { data: postTagData } = await supabase.from('post_tags').select('post_id').in('tag_id', tagIds)
          if (postTagData && postTagData.length > 0) {
            const postIds = [...new Set(postTagData.map(pt => pt.post_id))]
            const { data: artistPosts } = await supabase
              .from('posts')
              .select('*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*))')
              .in('id', postIds).order('created_at', { ascending: false }).limit(50)
            posts = artistPosts || []
          }
        }
      }
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <TimelineTabs />
      <div className="mt-4">
        {errorMessage ? (
          <p className="p-4 text-center text-gray-500">{errorMessage}</p>
        ) : posts.length === 0 ? (
          <p className="p-4 text-center text-gray-500">まだ投稿がありません。</p>
        ) : (
          posts.map(post => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  )
}