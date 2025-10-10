// src/app/signup/page.tsx（実際の配置に合わせてください）
import { signUp } from '@/app/(auth)/auth/actions'
import Link from 'next/link'

type SearchParams = {
  message?: string
}

export default async function SignupPage({
  searchParams,
}: {
  // Next.js 15: searchParams は Promise で渡ってくる
  searchParams: Promise<SearchParams>
}) {
  const { message } = await searchParams

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          アカウントを作成
        </h2>

        <form className="space-y-6" action={signUp}>
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
              ニックネーム
            </label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="user_id_text" className="block text-sm font-medium text-gray-700">
              ユーザーID
            </label>
            <input
              id="user_id_text"
              name="user_id_text"
              type="text"
              required
              pattern="^[a-zA-Z0-9_]+$"
              title="半角英数字とアンダースコア(_)のみ使用できます"
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="birthday" className="block text-sm font-medium text-gray-700">
              生年月日
            </label>
            <input
              id="birthday"
              name="birthday"
              type="date"
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              登録する
            </button>
          </div>
        </form>

        {message && (
          <p className="p-4 mt-4 text-center bg-gray-100 text-gray-800">{message}</p>
        )}

        <p className="mt-4 text-sm text-center">
          アカウントをお持ちですか？{' '}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}
