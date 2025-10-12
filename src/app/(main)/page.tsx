// src/app/page.tsx（実際のパスに合わせてください）
import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations, type Artist, type Profile } from '@/types'
import PostCard from '@/components/post/PostCard'
import Tab from '@/components/post/Tab'
import CreatePostForm from '@/components/post/CreatePostForm'

export const dynamic = 'force-dynamic'

type SearchParams = {
  tab?: 'all' | 'following'
  artistId?: string
}

type FavoriteArtistRow = { artists: Artist | null }
type FollowingRow = { following_id: string }
type TagRow = { post_id: number }

export default async function HomePage({
  searchParams,
}: {
  // Next.js 15: searchParams は Promise で渡ってくる
  searchParams: Promise<SearchParams>
}) {
  // Promise をアンラップ
  const sp = await searchParams
  const type: 'all' | 'following' = sp.tab === 'following' ? 'following' : 'all'

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  // --- お気に入りアーティスト ---
  let favoriteArtists: Artist[] = []
  if (user) {
    const { data } = await supabase
      .from('favorite_artists')
      .select('artists(*)')
      .eq('user_id', user.id)
      .order('sort_order')

    favoriteArtists =
      (data as FavoriteArtistRow[] | null)
        ?.map((fav) => fav.artists)
        .filter((a): a is Artist => a !== null) ?? []
  }

  // --- 投稿データ取得 ---
  let posts: PostWithRelations[] = []
  let errorMessage: string | null = null

  try {
    // ベースの SELECT
    let query = supabase
      .from('posts')
      .select(
        '*, profiles!inner(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)))'
      )
      .order('created_at', { ascending: false })

    // フォロー中タイムライン
    if (type === 'following' && user) {
      const { data: followingIdsData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id)

      const followingIds: string[] =
        (followingIdsData as FollowingRow[] | null)?.map((f) => f.following_id) ?? []

      if (followingIds.length === 0) {
        posts = []
      } else {
        query = query.in('user_id', followingIds)
      }
    }

    // 特定アーティストの投稿
    if (!posts.length && sp.artistId) {
      const { data: postIdsData } = await supabase
        .from('tags')
        .select('post_id')
        .eq('artist_id', sp.artistId)

      const postIds: number[] =
        (postIdsData as TagRow[] | null)?.map((p) => p.post_id) ?? []

      if (postIds.length === 0) {
        posts = []
      } else {
        query = query.in('id', postIds)
      }
    }

    // 実行（posts がまだ決まっていない場合のみ）
    if (!posts.length || type === 'all') {
      const { data, error } = await query
      if (error) throw error
      posts = (data ?? []) as PostWithRelations[]
    }
  } catch (err) {
    console.error('Error fetching posts:', err)
    errorMessage = '投稿の読み込みに失敗しました。'
  }

  return (
    <div className="w-full max-w-lg">
      {/* ログイン時のみ投稿フォーム表示 */}
      {user && userProfile && (
        <div className="border-b border-gray-200">
          <CreatePostForm userProfile={userProfile} />
        </div>
      )}

      <div className="w-full px-4 md:hidden">
        <Tab
          currentTab={type}
          currentArtistId={sp.artistId}
          favoriteArtists={favoriteArtists}
        />
      </div>

      {errorMessage ? (
        <p className="p-4 text-red-500">{errorMessage}</p>
      ) : posts.length === 0 ? (
        <p className="p-4 text-center text-gray-500">
          {type === 'following'
            ? 'フォロー中のユーザーの投稿はまだありません。'
            : sp.artistId
            ? 'このアーティストの投稿はまだありません。'
            : 'まだ投稿がありません。'}
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
