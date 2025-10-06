import { type CookieOptions, createServerClient } from '@supabase/ssr'
import { type cookies } from 'next/headers'

// 引数の型を Awaited<...> で囲みます。
// これにより、「cookies()をawaitした後の、実際のデータ」を期待するようになります。
export function createClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // サーバーコンポーネントから呼ばれた場合のエラーは無視してOK
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // サーバーコンポーネントから呼ばれた場合のエラーは無視してOK
          }
        },
      },
    }
  )
}