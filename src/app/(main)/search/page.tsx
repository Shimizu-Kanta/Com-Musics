import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations } from '@/types'
import PostCard from '@/components/post/PostCard'

type SearchParams = {
  q?: string
}

export default async function SearchPage({
  searchParams,
}: {
  // Next.js 15: searchParams は Promise で渡る
  searchParams: Promise<SearchParams>
}) {
  const { q } = await searchParams
  const query = q ?? ''
  const supabase = createClient()

  let posts: PostWithRelations[] = []

  if (query) {
    // Postgres function: search_posts(search_term text) → returns setof record(id int)
    const { data: postIdsData } = await supabase.rpc('search_posts', {
      search_term: query,
    })

    if (postIdsData && postIdsData.length > 0) {
      // no-explicit-any を避けるため、戻り値の要素型を明示
      const postIds = postIdsData.map((p: { id: number }) => p.id)

      const { data: searchResults } = await supabase
        .from('posts')
        .select(
          '*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*))'
        )
        .in('id', postIds)
        .order('created_at', { ascending: false })

      posts = searchResults ?? []
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto py-8 px-4">
      <h1 className="mb-6 text-2xl font-bold">
        検索結果: <span className="text-indigo-600">{query}</span>
      </h1>
      <div>
        {posts.length > 0 ? (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <p className="text-center text-gray-500">
            {query ? '投稿が見つかりませんでした。' : '検索キーワードを入力してください。'}
          </p>
        )}
      </div>
    </div>
  )
}
