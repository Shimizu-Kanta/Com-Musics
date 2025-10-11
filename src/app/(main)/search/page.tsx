import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations } from '@/types'
import PostCard from '@/components/post/PostCard'
import SearchBar from '@/components/shared/SearchBar' // SearchBarをインポート

type SearchPageProps = {
  searchParams: {
    q?: string
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || ''
  const supabase = createClient()
  
  let posts: PostWithRelations[] = []

  if (query) {
    const { data: postIdsData } = await supabase.rpc('search_posts', { search_term: query })

    if (postIdsData && postIdsData.length > 0) {
      const postIds = postIdsData.map((p: { id: number }) => p.id)
      
      const { data: searchResults } = await supabase
        .from('posts')
        .select('*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)))')
        .in('id', postIds)
        .order('created_at', { ascending: false })
      
      posts = searchResults || []
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto py-8 px-4">
      {/* ▼▼▼【重要】スマホの時だけ表示される検索バーを追加します ▼▼▼ */}
      <div className="md:hidden mb-4">
        <SearchBar />
      </div>

      <h1 className="text-2xl font-bold mb-6">
        検索結果: <span className="text-indigo-600">{query}</span>
      </h1>
      <div>
        {posts.length > 0 ? (
          posts.map(post => <PostCard key={post.id} post={post} />)
        ) : (
          <p className="text-center text-gray-500">
            {query ? '投稿が見つかりませんでした。' : '検索キーワードを入力してください。'}
          </p>
        )}
      </div>
    </div>
  )
}