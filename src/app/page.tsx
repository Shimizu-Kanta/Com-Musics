import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations } from '@/types'
import PostCard from '@/components/post/PostCard'
import TimelineTabs from '@/components/post/TimelineTabs'
import CreatePostForm from '@/components/post/CreatePostForm'

type SearchParams = {
  tab?: string
  artistId?: string
}

export default async function HomePage({
  searchParams,
}: {
  // Next.js 15: searchParams は Promise で渡ってくる
  searchParams: Promise<SearchParams>
}) {
  const { tab, artistId } = await searchParams
  const type = tab ?? 'all'
  const selectedArtistId = artistId

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let posts: PostWithRelations[] = []
  let errorMessage: string | null = null

  // 関連をまとめて取得する SELECT 句
  const selectStatement =
    '*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*))'

  if (type === 'all') {
    const { data: allPosts } = await supabase
      .from('posts')
      .select(selectStatement)
      .order('created_at', { ascending: false })
      .limit(50)
    posts = allPosts ?? []
  } else if (type === 'following') {
    if (!user) {
      errorMessage = 'フォロー中の人の投稿を見るには、ログインが必要です。'
    } else {
      const { data: followingData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id)

      if (followingData && followingData.length > 0) {
        const followingIds: string[] = followingData.map((f) => f.following_id)
        const { data: followingPosts } = await supabase
          .from('posts')
          .select(selectStatement)
          .in('user_id', followingIds)
          .order('created_at', { ascending: false })
          .limit(50)
        posts = followingPosts ?? []
      }
    }
  } else if (type === 'favorite_artists_all') {
    if (!user) {
      errorMessage = '好きなアーティストの投稿を見るには、ログインが必要です。'
    } else {
      // 特定アーティスト指定があればそれを優先、なければユーザーのお気に入り全アーティスト
      let artistIdList: string[] = []
      if (selectedArtistId) {
        artistIdList = [selectedArtistId]
      } else {
        const { data: favArtistsData } = await supabase
          .from('favorite_artists')
          .select('artist_id')
          .eq('user_id', user.id)
        if (favArtistsData) {
          artistIdList = favArtistsData.map((fa) => fa.artist_id)
        }
      }

      if (artistIdList.length > 0) {
        // アーティストに紐づく楽曲ID
        const { data: songData } = await supabase
          .from('songs')
          .select('id')
          .in('artist_id', artistIdList)
        const songIds: number[] = songData ? songData.map((s) => s.id) : []

        // tags テーブルで artist_id or song_id が一致する投稿IDを取得
        let orFilter = `artist_id.in.(${artistIdList.join(',')})`
        if (songIds.length > 0) {
          orFilter += `,song_id.in.(${songIds.join(',')})`
        }

        const { data: tagData } = await supabase
          .from('tags')
          .select('post_id')
          .or(orFilter)

        if (tagData && tagData.length > 0) {
          const postIds = Array.from(new Set<number>(tagData.map((t) => t.post_id)))
          const { data: artistPosts } = await supabase
            .from('posts')
            .select(selectStatement)
            .in('id', postIds)
            .order('created_at', { ascending: false })
            .limit(50)
          posts = artistPosts ?? []
        }
      }
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <CreatePostForm />
      <TimelineTabs />
      <div className="mt-4">
        {errorMessage ? (
          <p className="p-4 text-center text-gray-500">{errorMessage}</p>
        ) : posts.length === 0 ? (
          <p className="p-4 text-center text-gray-500">まだ投稿がありません。</p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  )
}
