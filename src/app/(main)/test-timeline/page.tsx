import { createClient } from '@/lib/supabase/server'
// ▼▼▼【重要】_test対応の fetchPosts をインポート ▼▼▼
// (actions.ts に fetchPosts という名前で _test 対応版が存在すると仮定)
import { fetchTestPosts } from '../post/actions'
import { type PostWithRelations, type Profile } from '@/types' // _test 対応済みの型
import PostList from '@/components/post/PostList' // _test 対応済みの PostList
import CreatePostForm from '@/components/post/CreatePostForm' // _test 対応済みの CreatePostForm

export const dynamic = 'force-dynamic'

// このページはシンプルに投稿一覧を表示するだけ
export default async function TestTimelinePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ログインユーザーのプロフィール取得 (CreatePostForm用)
  let userProfile: Profile | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    userProfile = profile
  }

  // ▼▼▼ _test 対応の fetchPosts を呼び出す ▼▼▼
  let initialPosts: PostWithRelations[] = []
  let errorMessage: string | null = null
  try {
    initialPosts = await fetchTestPosts({
      page: 1, // 最初のページ
      userId: user?.id, // いいね判定用
      // ▼ 他の絞り込み条件は一旦なし (シンプルに全件取得)
    })
  } catch (err) {
    console.error('Error fetching test posts:', err)
    errorMessage = 'テスト投稿の読み込みに失敗しました。'
  }
  // ▲▲▲

  return (
    <div className="w-full max-w-lg">
      <h1 className="text-xl font-bold p-4 border-b">テストタイムライン (_test スキーマ)</h1>
      {/* 投稿フォームも表示してみる */}
      {user && userProfile && (
        <div className="border-b border-gray-200">
          <CreatePostForm userProfile={userProfile} />
        </div>
      )}
      {errorMessage ? (
        <p className="p-4 text-red-500">{errorMessage}</p>
      ) : (
        // _test 対応済みの PostList を使用
        <PostList initialPosts={initialPosts} userId={user?.id} />
      )}
    </div>
  )
}