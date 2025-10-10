'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function uploadTestImage(formData: FormData) {

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // ログインしているユーザー情報を取得
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'エラー: ログインしていません。' }
  }

  // フォームから 'testImage' という名前のファイルを取得
  const file = formData.get('testImage') as File | null
  if (!file || file.size === 0) {
    return { success: false, message: 'エラー: ファイルが選択されていません。' }
  }

  // ファイルパスを生成 (例: 'ユーザーID/test-1678886400000')
  const filePath = `${user.id}/test-${Date.now()}`

  try {
    // 'user_images' バケットにファイルをアップロード

    console.log('--- 環境変数チェック ---');
    console.log('サーバーが見ているSupabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('ファイルパス:',filePath);
    console.log('ユーザID', user.id);
    console.log('--------------------');

    const { error } = await supabase.storage.from('user_images').upload(filePath, file)

    // もしアップロードでエラーが発生したら、その内容を返す
    if (error) {
      console.error('Supabase Storage Error:', error)
      // Supabaseから返ってきた詳細なエラーメッセージをそのまま返します
      return { success: false, message: `アップロード失敗: ${error.message}` }
    }

    // 成功したら、成功メッセージとファイルパスを返す
    return { success: true, message: `成功！ファイルが ${filePath} にアップロードされました。` }

  } catch (e: unknown) {
    const message = e instanceof Error ? e.name : '不明なエラー'
    console.error('Catch Block Error:', e)
    return { success: false, message: `予期せぬエラーが発生しました: ${message}` }
  }
}