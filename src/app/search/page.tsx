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
    // Step 1: 作成したデータベース関数(RPC)を呼び出して、一致する投稿IDを取得
    const { data: postIdsData } = await supabase.rpc('search_posts', { search_term: query })

    if (postIdsData && postIdsData.length > 0) {
      const postIds = postIdsData.map(p => p.id)
      
      // Step 2: 取得した投稿IDに一致する、完全な投稿データを取得
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