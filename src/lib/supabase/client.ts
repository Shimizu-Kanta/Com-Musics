import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = "https://syrrxjjfzkwnspbkhrsf.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cnJ4ampmemt3bnNwYmtocnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTQ5ODAsImV4cCI6MjA3NTMzMDk4MH0.qLD8Jqg4E_Yxmpn9kKB7vcyGr8zA9H5dZL5g_sgEUIM"

export function createClient() {
  // 環境変数からSupabaseのURLとanonキーを取得してクライアントを作成
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )
}