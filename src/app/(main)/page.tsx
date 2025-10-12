// src/app/(main)/page.tsx
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

type FollowingRow = { following_id: string }
type TagRow = { post_id: number }

// ★ 追加: artists が単体/配列どちらでも来る可能性に対応するための行型
type FavoriteArtistsJoinRow =
  | { artists: Artist | null }
  | { artists: Artist[] | null }

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const type: 'all' | 'following' = sp.tab === 'following' ? 'following' : 'all'

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userProfile: Profile | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    userProfile = profile
  }

  // ▼ 修正: artists を単体/配列どちらでも安全に Artist[] へ正規化
  let favoriteArtists: Artist[] = []
  if (user) {
    const { data: favArtistData } = await supabase
      .from('favorite_artists')
      .select('artists(*)')
      .eq('user_id', user.id)
      .order('sort_order')

    favoriteArtists =
      (favArtistData as FavoriteArtistsJoinRow[] | null)
        ?.flatMap((row) => {
          const a = (row as { artists: Artist | Artist[] | null }).artists
          if (!a) return []
          return Array.isArray(a) ? a : [a]
        }) ?? []
  }

  let posts: PostWithRelations[] = []
  let errorMessage: string | null = null

  try {
    let query = supabase
      .from('posts')
      .select(
        '*, profiles!inner(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)))'
      )
      .order('created_at', { ascending: false })

    let shouldSkipFetch = false

    if (type === 'following' && user) {
      const { data: followingIdsData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id)
      const followingIds =
        (followingIdsData as FollowingRow[] | null)?.map((f) => f.following_id) ?? []
      if (followingIds.length === 0) {
        posts = []
        shouldSkipFetch = true
      } else {
        query = query.in('user_id', followingIds)
      }
    } else if (sp.artistId) {
      const { data: postIdsData } = await supabase
        .from('tags')
        .select('post_id')
        .eq('artist_id', sp.artistId)
      const postIds =
        (postIdsData as TagRow[] | null)?.map((p) => p.post_id) ?? []
      if (postIds.length === 0) {
        posts = []
        shouldSkipFetch = true
      } else {
        query = query.in('id', postIds)
      }
    }

    if (!shouldSkipFetch) {
      const { data, error } = await query
      if (error) throw error

      // like配列に対して user が含まれるかを判定（any 不使用）
      posts = (data ?? []).map((post) => ({
        ...post,
        is_liked_by_user:
          !!user && Array.isArray(post.likes)
            ? post.likes.some((like: { user_id: string }) => like.user_id === user.id)
            : false,
      }))
    }
  } catch (err) {
    console.error('Error fetching posts:', err)
    errorMessage = '投稿の読み込みに失敗しました。'
  }

  return (
    <div className="w-full max-w-lg">
      {user && userProfile && (
        <div className="border-b border-gray-200">
          <CreatePostForm userProfile={userProfile} />
        </div>
      )}
      {/* ▼ 微修正: Tailwind のクラス記法 md-hidden → md:hidden */}
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
