import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations } from '@/types'
import PostCard from '@/components/post/PostCard'
import TimelineTabs from '@/components/post/TimelineTabs'

type HomePageProps = {
  searchParams: {
    tab?: string
    artistId?: string // artistIdを受け取れるように追加
  }
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const type = searchParams.tab || 'all'
  const selectedArtistId = searchParams.artistId // URLからartistIdを取得

  let posts: PostWithRelations[] = []
  let errorMessage: string | null = null
  const selectStatement = '*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*))'

  if (type === 'all') {
    const { data: allPosts } = await supabase.from('posts').select(selectStatement).order('created_at', { ascending: false }).limit(50)
    posts = allPosts || []
  } 
  else if (type === 'following') {
    if (!user) {
      errorMessage = 'フォロー中の人の投稿を見るには、ログインが必要です。'
    } else {
      const { data: followingData } = await supabase.from('followers').select('following_id').eq('follower_id', user.id)
      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map(f => f.following_id)
        const { data: followingPosts } = await supabase.from('posts').select(selectStatement).in('user_id', followingIds).order('created_at', { ascending: false }).limit(50)
        posts = followingPosts || []
      }
    }
  } 
  else if (type === 'favorite_artists_all') {
    if (!user) {
      errorMessage = '好きなアーティストの投稿を見るには、ログインが必要です。'
    } else {
      // ▼▼▼【ここからが今回の修正点です】▼▼▼
      // もし特定のアーティストIDが選択されていたら、そのIDだけをリストに入れます。
      // そうでなければ、これまで通り全ての好きなアーティストのIDを取得します。
      let artistIdList: string[] = []
      if (selectedArtistId) {
        artistIdList = [selectedArtistId]
      } else {
        const { data: favArtistsData } = await supabase.from('favorite_artists').select('artist_id').eq('user_id', user.id);
        if (favArtistsData) {
          artistIdList = favArtistsData.map(fa => fa.artist_id);
        }
      }

      if (artistIdList.length > 0) {
        const { data: songData } = await supabase.from('songs').select('id').in('artist_id', artistIdList);
        const songIds = songData ? songData.map(s => s.id) : [];

        let orFilter = `artist_id.in.(${artistIdList.join(',')})`
        if (songIds.length > 0) {
          orFilter += `,song_id.in.(${songIds.join(',')})`
        }
        
        const { data: tagData } = await supabase.from('tags').select('post_id').or(orFilter);

        if (tagData && tagData.length > 0) {
          const postIds = [...new Set(tagData.map(t => t.post_id))];
          const { data: artistPosts } = await supabase.from('posts').select(selectStatement).in('id', postIds).order('created_at', { ascending: false }).limit(50);
          posts = artistPosts || [];
        }
      }
      // ▲▲▲【ここまでが修正点です】▲▲▲
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