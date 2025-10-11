// src/app/page.tsx（実際のパスに合わせてください）
import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations, type Artist } from '@/types'
import PostCard from '@/components/post/PostCard'
import Tab from '@/components/post/Tab'

// --- 型定義（any を使わず明示） ---
type SearchParams = {
  tab?: 'all' | 'following'
  artistId?: string
  [key: string]: string | string[] | undefined
}

type FavoriteArtistRow = { artists: Artist | null }
type FollowingRow = { following_id: string }
type TagRow = { post_id: number }

export default async function HomePage({
  searchParams,
}: {
  // Next.js 15: searchParams は Promise で渡る
  searchParams: Promise<SearchParams>
}) {
  // Promise をアンラップ
  const sp = await searchParams
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ▼ お気に入りアーティスト（型安全に抽出）
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

  // ▼ 投稿データ取得（tab/artistId に応じて切替）
  const { posts, errorMessage } = await (async () => {
    try {
      if (sp.tab === 'following' && user) {
        const { data: followingIdsData, error: followingIdsError } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', user.id)

        if (followingIdsError) throw followingIdsError

        const followingIds: string[] =
          (followingIdsData as FollowingRow[] | null)?.map((f) => f.following_id) ??
          []

        if (followingIds.length === 0) {
          return { posts: [] as PostWithRelations[], errorMessage: null as string | null }
        }

        const { data: followingPosts, error } = await supabase
          .from('posts')
          .select(
            '*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)))'
          )
          .in('user_id', followingIds)
          .order('created_at', { ascending: false })

        if (error) throw error
        return { posts: (followingPosts ?? []) as PostWithRelations[], errorMessage: null }
      } else {
        // all or 未ログイン時
        let query = supabase
          .from('posts')
          .select(
            '*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)))'
          )
          .order('created_at', { ascending: false })

        if (sp.artistId) {
          const { data: postIdsData, error: postIdsError } = await supabase
            .from('tags')
            .select('post_id')
            .eq('artist_id', sp.artistId)

          if (postIdsError) throw postIdsError

          const postIds: number[] =
            (postIdsData as TagRow[] | null)?.map((p) => p.post_id) ?? []

          if (postIds.length > 0) {
            query = query.in('id', postIds)
          } else {
            return { posts: [] as PostWithRelations[], errorMessage: null as string | null }
          }
        }

        const { data: allPosts, error } = await query
        if (error) throw error
        return { posts: (allPosts ?? []) as PostWithRelations[], errorMessage: null }
      }
    } catch (err) {
      console.error(err)
      return {
        posts: [] as PostWithRelations[],
        errorMessage: '投稿の読み込みに失敗しました。',
      }
    }
  })()

  const currentTab: 'all' | 'following' = sp.tab === 'following' ? 'following' : 'all'

  return (
    <div className="w-full max-w-lg">
      <div className="w-full px-4 md:hidden">
        {/* タブに必要情報を渡す */}
        <Tab
          currentTab={currentTab}
          currentArtistId={typeof sp.artistId === 'string' ? sp.artistId : undefined}
          favoriteArtists={favoriteArtists}
        />
      </div>

      {errorMessage ? (
        <p className="p-4 text-red-500">{errorMessage}</p>
      ) : posts.length === 0 ? (
        <p className="p-4 text-center text-gray-500">
          {currentTab === 'following'
            ? 'フォロー中のユーザーの投稿はまだありません。'
            : sp.artistId
            ? 'このアーティストの投稿はまだありません。'
            : 'まだ投稿がありません。'}
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
