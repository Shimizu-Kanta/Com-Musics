import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations, type Artist } from '@/types'
import PostCard from '@/components/post/PostCard'
import Tab from '@/components/post/Tab'

type HomePageProps = {
  searchParams: {
    tab?: 'all' | 'following'
    artistId?: string
    [key: string]: string | string[] | undefined
  }
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ▼▼▼【重要】お気に入りアーティストのリストを取得するロジックを追加します ▼▼▼
  let favoriteArtists: Artist[] = []
  if (user) {
    const { data } = await supabase
      .from('favorite_artists')
      .select('artists(*)')
      .eq('user_id', user.id)
      .order('sort_order')
    favoriteArtists = data?.flatMap(fav => fav.artists).filter(Boolean) as Artist[] || []
  }

  // 投稿データを取得するロジック (変更なし)
  const { posts, errorMessage } = await (async () => {
    try {
      if (searchParams.tab === 'following' && user) {
        const { data: followingIdsData, error: followingIdsError } = await supabase.from('followers').select('following_id').eq('follower_id', user.id)
        if (followingIdsError) throw followingIdsError
        const followingIds = followingIdsData.map(f => f.following_id)
        if (followingIds.length === 0) return { posts: [], errorMessage: null }
        const { data: followingPosts, error } = await supabase.from('posts').select('*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)))').in('user_id', followingIds).order('created_at', { ascending: false })
        if (error) throw error
        return { posts: (followingPosts || []) as PostWithRelations[], errorMessage: null }
      } else {
        let query = supabase.from('posts').select('*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)))').order('created_at', { ascending: false })
        if (searchParams.artistId) {
          const { data: postIdsData, error: postIdsError } = await supabase.from('tags').select('post_id').eq('artist_id', searchParams.artistId)
          if (postIdsError) throw postIdsError
          const postIds = postIdsData?.map(p => p.post_id) ?? []
          if (postIds.length > 0) { query = query.in('id', postIds) } 
          else { return { posts: [], errorMessage: null } }
        }
        const { data: allPosts, error } = await query
        if (error) throw error
        return { posts: (allPosts || []) as PostWithRelations[], errorMessage: null }
      }
    } catch (error) {
      console.error(error)
      return { posts: [] as PostWithRelations[], errorMessage: '投稿の読み込みに失敗しました。' }
    }
  })();

  const type = searchParams.tab === 'following' ? 'following' : 'all'

  return (
    <div className="w-full max-w-lg">
      <div className="w-full px-4 md:hidden">
        {/* ▼▼▼【重要】進化したタブに、必要な情報をすべて渡します ▼▼▼ */}
        <Tab
          currentTab={type}
          currentArtistId={searchParams.artistId}
          favoriteArtists={favoriteArtists}
        />
      </div>

      {errorMessage ? (
        <p className="p-4 text-red-500">{errorMessage}</p>
      ) : posts.length === 0 ? (
        <p className="p-4 text-center text-gray-500">
          {searchParams.tab === 'following' ? 'フォロー中のユーザーの投稿はまだありません。' : searchParams.artistId ? 'このアーティストの投稿はまだありません。' : 'まだ投稿がありません。'}
        </p>
      ) : (
        <div className="mt-4 md:mt-0">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}