import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations, type Artist, type Profile } from '@/types'
import Tab from '@/components/post/Tab'
import CreatePostForm from '@/components/post/CreatePostForm'
import PostList from '@/components/post/PostList' // 無限スクロール用の新しい部品をインポート

export const dynamic = 'force-dynamic'

type SearchParams = {
  tab?: 'all' | 'following'
  artistId?: string
}

type FollowingRow = { following_id: string }
type TagRow = { post_id: number }
type FavoriteArtistsJoinRow =
  | { artists: Artist | null }
  | { artists: Artist[] | null }

const POSTS_PER_PAGE = 20;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // --- ログインユーザーのプロフィール情報 ---
  let userProfile: Profile | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    userProfile = profile
  }

  // --- お気に入りアーティストの情報 ---
  let favoriteArtists: Artist[] = []
  if (user) {
    const { data: favArtistData } = await supabase
      .from('favorite_artists')
      .select('artists(*)')
      .eq('user_id', user.id)
      .order('sort_order')
    
    if (favArtistData) {
      favoriteArtists = favArtistData
        .map((item: FavoriteArtistsJoinRow) => item.artists)
        .flat()
        .filter((artist): artist is Artist => artist !== null);
    }
  }

  // --- 最初の投稿20件だけを取得する ---
  let initialPosts: PostWithRelations[] = []
  let errorMessage: string | null = null
  try {
    let query = supabase
      .from('posts')
      .select('*, profiles!inner(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)))')
      .order('created_at', { ascending: false })
      .range(0, POSTS_PER_PAGE - 1) // 最初の20件に絞る

    let shouldSkipQuery = false

    if (sp.tab === 'following' && user) {
      const { data: followingIdsData } = await supabase.from('followers').select('following_id').eq('follower_id', user.id)
      const followingIds = (followingIdsData as FollowingRow[] | null)?.map(f => f.following_id) ?? []
      if (followingIds.length > 0) {
        query = query.in('user_id', followingIds)
      } else {
        initialPosts = []
        shouldSkipQuery = true
      }
    } else if (sp.artistId) {
      const { data: postIdsData } = await supabase.from('tags').select('post_id').eq('artist_id', sp.artistId)
      const postIds = (postIdsData as TagRow[] | null)?.map((p) => p.post_id) ?? []
      if (postIds.length > 0) {
        query = query.in('id', postIds)
      } else {
        initialPosts = []
        shouldSkipQuery = true
      }
    }
    
    if (!shouldSkipQuery) {
      const { data, error } = await query
      if (error) throw error
      initialPosts = (data ?? []).map((post) => ({
        ...post,
        is_liked_by_user:
          !!user && Array.isArray(post.likes)
            ? post.likes.some((like: { user_id: string }) => like.user_id === user.id)
            : false,
      }))
    }
  } catch (err) {
    console.error('Error fetching initial posts:', err)
    errorMessage = '投稿の読み込みに失敗しました。'
  }

  return (
    <div className="w-full max-w-lg">
      {user && userProfile && (
        <div className="border-b border-gray-200">
          <CreatePostForm userProfile={userProfile} />
        </div>
      )}
      <div className="w-full px-4 md:hidden">
        <Tab
          currentTab={sp.tab || 'all'}
          currentArtistId={sp.artistId}
          favoriteArtists={favoriteArtists}
        />
      </div>

      {errorMessage ? (
        <p className="p-4 text-red-500">{errorMessage}</p>
      ) : (
        // ▼▼▼ 投稿リストの表示を、新しいPostList部品に任せます ▼▼▼
        <PostList initialPosts={initialPosts} userId={user?.id} />
      )}
    </div>
  )
}