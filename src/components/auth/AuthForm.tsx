'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthForm() {
  const supabase = createClient()
  const router = useRouter()

  // ★★★★★ ここからが追加点 ★★★★★
  useEffect(() => {
    // ログイン状態の変化を監視します
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // もしイベントが「SIGNED_IN（ログイン成功）」だったら...
      if (event === 'SIGNED_IN') {
        // router.push('/')だけだと、クライアント側だけの遷移になり、
        // サーバーがログイン状態を認識できない場合があるため、
        // router.refresh()でサーバーに「ページを更新しろ」と強制的に命令します。
        // これにより、リダイレクトループを断ち切ります。
        router.push('/')
        router.refresh()
      }
    })

    // コンポーネントが不要になったら監視を解除します
    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])
  // ★★★★★ ここまでが追加点 ★★★★★

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          Com-Musicsへようこそ
        </h2>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="default"
          showLinks={false}
          providers={[]}
          view="sign_in"
          localization={{
            variables: {
              sign_in: {
                email_label: 'メールアドレス',
                password_label: 'パスワード',
                button_label: 'ログイン',
              },
            },
          }}
        />
        <p className="mt-4 text-sm text-center">
          アカウントをお持ちでないですか？{' '}
          <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
            アカウントを作成
          </Link>
        </p>
      </div>
    </div>
  )
}