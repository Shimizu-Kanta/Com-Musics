'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { type Tag } from '@/components/post/TagSearch'

// プロフィール情報を更新する関数
export async function updateProfile(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. ログイン中のユーザー情報を取得 (本人確認のため)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to update your profile.' }
  }
  
  // 2. フォームから送信されたデータを取得
  const nickname = formData.get('nickname') as string
  const bio = formData.get('bio') as string
  const favoriteSongs: Tag[] = JSON.parse(formData.get('favoriteSongs') as string)
  const favoriteArtists: Tag[] = JSON.parse(formData.get('favoriteArtists') as string)
  
  // 3. profilesテーブルのnicknameとbioを更新
  await supabase.from('profiles').update({ nickname, bio }).eq('id', user.id)

  // 4. お気に入りの曲を更新 (古いものを全削除 -> 新しいものを全挿入)
  // 4a. まず、ユーザーの古いお気に入りの曲を全て削除
  await supabase.from('favorite_songs').delete().eq('user_id', user.id)
  // 4b. 新しいお気に入りの曲があれば、1件ずつ挿入
  if (favoriteSongs.length > 0) {
    // 挿入する前に、songsテーブルに曲情報が存在することを確認 (upsert)
    for (const song of favoriteSongs) {
      // --- ★★★★★ ここからが修正点 ★★★★★ ---
      // 2a. まず親であるアーティストを登録
      await supabase.from('artists').upsert({ id: song.artistId!, name: song.artistName! })
      // 2b. 次に子である曲を登録 (正しいartistIdを使う)
      await supabase.from('songs').upsert({ id: song.id, name: song.name, artist_id: song.artistId!, album_art_url: song.imageUrl })
      // --- ★★★★★ ここまでが修正点 ★★★★★ ---
    }
    const songsToInsert = favoriteSongs.map(song => ({ user_id: user.id, song_id: song.id }))
    await supabase.from('favorite_songs').insert(songsToInsert)
  }

  // 5. お気に入りのアーティストを更新 (曲と同様)
  await supabase.from('favorite_artists').delete().eq('user_id', user.id)
  if (favoriteArtists.length > 0) {
    for (const artist of favoriteArtists) {
      await supabase.from('artists').upsert({ id: artist.id, name: artist.name, image_url: artist.imageUrl })
    }
    const artistsToInsert = favoriteArtists.map(artist => ({ user_id: user.id, artist_id: artist.id }))
    await supabase.from('favorite_artists').insert(artistsToInsert)
  }

  // 6. プロフィールページを再読み込みして、変更を反映させる
  const user_id_text = formData.get('user_id_text') as string
  revalidatePath(`/${user_id_text}`)
  revalidatePath(`/${user_id_text}/edit`)
}