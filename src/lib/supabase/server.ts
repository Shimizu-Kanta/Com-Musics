import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // get関数を 'async' に変更します
        async get(name: string) {
          // この関数の内部で 'cookies()' を呼び出し、'await' します
          return (await cookies()).get(name)?.value
        },
        // set関数も 'async' に変更します
        async set(name: string, value: string, options: CookieOptions) {
          try {
            // 同様に、内部で 'cookies()' を呼び出して 'await' します
            (await cookies()).set({ name, value, ...options })
          } catch (error) {
            // Server Componentから呼ばれた場合はエラーが発生することがありますが、
            // middlewareでセッションを更新していれば無視して問題ありません。
          }
        },
        // remove関数も 'async' に変更します
        async remove(name: string, options: CookieOptions) {
          try {
            // 同様に、内部で 'cookies()' を呼び出して 'await' します
            (await cookies()).set({ name, value: '', ...options })
          } catch (error) {
            // Server Componentから呼ばれた場合はエラーが発生することがありますが、無視して問題ありません。
          }
        },
      },
    }
  )
}