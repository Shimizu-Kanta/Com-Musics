import { createClient } from '@/lib/supabase/server'
import { type PostWithRelations } from '@/types'
import PostCard from '@/components/post/PostCard'

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
      // ▼▼▼【重要】ここで p の型を (p: { id: number }) と明示的に指定します ▼▼▼
      const postIds = postIdsData.map((p: { id: number }) => p.id)
      
      const { data: searchResults } = await supabase
        .from('posts')
        .select('*, profiles(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*))')
        .in('id', postIds)
        .order('created_at', { ascending: false })
      
      posts = searchResults || []
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto py-8 px-4">
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