import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations, type Artist, type Profile } from '@/types'
import Tab from '@/components/post/Tab'
import CreatePostForm from '@/components/post/CreatePostForm'
import PostList from '@/components/post/PostList'

export const dynamic = 'force-dynamic'

type SearchParams = {
  tab?: 'all' | 'following'
  artistId?: string
}

type FollowingRow = { following_id: string }
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

  let userProfile: Profile | null = null
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    userProfile = profile
  }

  let favoriteArtists: Artist[] = []
  if (user) {
    const { data: favArtistData } = await supabase.from('favorite_artists').select('artists(*)').eq('user_id', user.id).order('sort_order')
    if (favArtistData) {
      favoriteArtists = favArtistData
        .map((item: FavoriteArtistsJoinRow) => item.artists)
        .flat()
        .filter((artist): artist is Artist => artist !== null);
    }
  }

  let initialPosts: PostWithRelations[] = []
  let errorMessage: string | null = null
  try {
    let query = supabase
      .from('posts')
      .select('*, profiles!inner(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)), videos_test(*, artists_test(*)))')
      .order('created_at', { ascending: false })
      
    // ▼▼▼【重要】ここにも賢い調査方法を実装します ▼▼▼
    let shouldSkipQuery = false;
    
    if (sp.tab === 'following' && user) {
      const { data: followingIdsData } = await supabase.from('followers').select('following_id').eq('follower_id', user.id)
      const followingIds = (followingIdsData as FollowingRow[] | null)?.map(f => f.following_id) ?? []
      if (followingIds.length > 0) {
        query = query.in('user_id', followingIds)
      } else {
        shouldSkipQuery = true
      }
    } else if (sp.artistId) {
      const allPostIds = new Set<number>()
      const { data: directTags } = await supabase.from('tags').select('post_id').eq('artist_id', sp.artistId)
      directTags?.forEach(t => allPostIds.add(t.post_id))
      const { data: songIds } = await supabase.from('songs').select('id').eq('artist_id', sp.artistId)
      if (songIds && songIds.length > 0) {
        const { data: songTags } = await supabase.from('tags').select('post_id').in('song_id', songIds.map(s => s.id))
        songTags?.forEach(t => allPostIds.add(t.post_id))
      }
      const { data: liveIds } = await supabase.from('live_artists').select('live_id').eq('artist_id', sp.artistId)
      if (liveIds && liveIds.length > 0) {
        const { data: liveTags } = await supabase.from('tags').select('post_id').in('live_id', liveIds.map(l => l.live_id))
        liveTags?.forEach(t => allPostIds.add(t.post_id))
      }
      
      const uniquePostIds = Array.from(allPostIds)
      if (uniquePostIds.length > 0) {
        query = query.in('id', uniquePostIds)
      } else {
        shouldSkipQuery = true
      }
    }
    
    if (shouldSkipQuery) {
      initialPosts = []
    } else {
      const { data, error } = await query.range(0, POSTS_PER_PAGE - 1)
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
        <PostList initialPosts={initialPosts} userId={user?.id} />
      )}
    </div>
  )
}