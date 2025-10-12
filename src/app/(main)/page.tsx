import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations, type Artist, type Profile } from '@/types'
import PostCard from '@/components/post/PostCard'
import Tab from '@/components/post/Tab'
import CreatePostForm from '@/components/post/CreatePostForm' // ▼▼▼【重要】投稿フォームをインポートします ▼▼▼

type HomePageProps = {
  searchParams: {
    tab?: 'all' | 'following'
    artistId?: string
  }
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // --- ログインユーザーのプロフィール情報を取得 ---
  let userProfile: Profile | null = null
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    userProfile = profile
  }

  // --- お気に入りアーティストを取得 ---
  let favoriteArtists: Artist[] = []
  if (user) {
    const { data } = await supabase
      .from('favorite_artists')
      .select('artists(*)')
      .eq('user_id', user.id)
      .order('sort_order')
    favoriteArtists = data?.flatMap(fav => fav.artists).filter(Boolean) as Artist[] || []
  }

  // --- 投稿データを取得 ---
  let posts: PostWithRelations[] = []
  let errorMessage: string | null = null

  try {
    const { tab, artistId } = searchParams
    let query = supabase
      .from('posts')
      .select('*, profiles!inner(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)))')
      .order('created_at', { ascending: false })

    if (tab === 'following' && user) {
      const { data: followingIdsData } = await supabase.from('followers').select('following_id').eq('follower_id', user.id)
      const followingIds = followingIdsData?.map(f => f.following_id) ?? []
      if (followingIds.length > 0) {
        query = query.in('user_id', followingIds)
      } else {
        posts = []
      }
    } else if (artistId) {
      const { data: postIdsData } = await supabase.from('tags').select('post_id').eq('artist_id', artistId)
      const postIds = postIdsData?.map(p => p.post_id) ?? []
      if (postIds.length > 0) {
        query = query.in('id', postIds)
      } else {
        posts = []
      }
    }
    
    // postsがまだ空の場合のみクエリ実行
    if (posts.length === 0 && !(tab === 'following' && user && (await supabase.from('followers').select('following_id').eq('follower_id', user.id)).data?.length === 0) && !(artistId && (await supabase.from('tags').select('post_id').eq('artist_id', artistId)).data?.length === 0)) {
        const { data, error } = await query
        if (error) throw error
        posts = data || []
    }

  } catch (error) {
    console.error('Error fetching posts:', error)
    errorMessage = '投稿の読み込みに失敗しました。'
  }

  const type = searchParams.tab === 'following' ? 'following' : 'all'

  return (
    <div className="w-full max-w-lg">
      {/* ▼▼▼【重要】ログインしている場合に、投稿フォームを表示します ▼▼▼ */}
      {user && userProfile && (
        <div className="border-b border-gray-200">
          <CreatePostForm userProfile={userProfile} />
        </div>
      )}

      <div className="w-full px-4 md:hidden">
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
        <div className="md:mt-0">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}