'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { type Tag } from '@/components/post/TagSearch'
import { type SongInsert, type ArtistInsert } from '@/types'
import { type SupabaseClient } from '@supabase/supabase-js'

async function uploadImage(supabase: SupabaseClient, userId: string, file: File, type: 'avatar' | 'header') {
  if (file.size === 0) return null
  const fileExt = file.name.split('.').pop()
  const filePath = `${userId}/${type}-${Date.now()}.${fileExt}`
  const { error } = await supabase.storage.from('user-images').upload(filePath, file)
  if (error) {
    console.error(`Upload Error:`, error)
    throw new Error(`${type === 'avatar' ? 'アイコン' : 'ヘッダー'}画像のアップロードに失敗しました。`)
  }
  const { data } = supabase.storage.from('user-images').getPublicUrl(filePath)
  return data.publicUrl
}

export async function updateProfile(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  try {
    const nickname = formData.get('nickname') as string
    const bio = formData.get('bio') as string
    const userIdText = formData.get('user_id_text') as string
    const avatarFile = formData.get('avatar') as File | null
    const headerFile = formData.get('header') as File | null
    const favoriteSongs: Tag[] = JSON.parse(formData.get('favoriteSongs') as string)
    const favoriteArtists: Tag[] = JSON.parse(formData.get('favoriteArtists') as string)
    
    const profileUpdateData: {
      nickname: string
      bio: string
      avatar_url?: string | null
      header_image_url?: string | null
    } = { nickname, bio }

    if (avatarFile && avatarFile.size > 0) {
      profileUpdateData.avatar_url = await uploadImage(supabase, user.id, avatarFile, 'avatar')
    }
    if (headerFile && headerFile.size > 0) {
      profileUpdateData.header_image_url = await uploadImage(supabase, user.id, headerFile, 'header')
    }

    const { error: profileError } = await supabase.from('profiles').update(profileUpdateData).eq('id', user.id)
    if (profileError) throw profileError

    // --- お気に入り曲の更新 ---
    await supabase.from('favorite_songs').delete().eq('user_id', user.id)
    if (favoriteSongs.length > 0) {
      const artistsToUpsert = favoriteSongs
        .filter(song => song.artistId && song.artistName)
        .map(song => ({ id: song.artistId!, name: song.artistName! }));
      if (artistsToUpsert.length > 0) await supabase.from('artists').upsert(artistsToUpsert);
      
      const songsToUpsert = favoriteSongs.map(song => ({ id: song.id, name: song.name, artist_id: song.artistId!, album_art_url: song.imageUrl }));
      if (songsToUpsert.length > 0) await supabase.from('songs').upsert(songsToUpsert);

      const favSongsToInsert = favoriteSongs.map(song => ({ user_id: user.id, song_id: song.id }))
      if (favSongsToInsert.length > 0) await supabase.from('favorite_songs').insert(favSongsToInsert)
    }

    // --- お気に入りアーティストの更新 ---
    await supabase.from('favorite_artists').delete().eq('user_id', user.id)
    if (favoriteArtists.length > 0) {
      const artistsToUpsert = favoriteArtists.map(artist => ({ id: artist.id, name: artist.name, image_url: artist.imageUrl }));
      if(artistsToUpsert.length > 0) await supabase.from('artists').upsert(artistsToUpsert);

      const favArtistsToInsert = favoriteArtists.map(artist => ({ user_id: user.id, artist_id: artist.id }))
      if (favArtistsToInsert.length > 0) await supabase.from('favorite_artists').insert(favArtistsToInsert);
    }

    // --- 成功時の処理 ---
    revalidatePath(`/${userIdText}`)
    revalidatePath(`/${userIdText}/edit`)

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'プロフィールの更新に失敗しました。'
    console.error('Update Profile Error:', error)
    // 失敗した場合は、エラーメッセージを返却
    return { error: message }
  }
  
  // ▼▼▼【重要】リダイレクトは try...catch の外に移動します ▼▼▼
  // これにより、tryブロックが正常に完了した場合にのみ、リダイレクトが実行されることが保証されます。
  const userIdText = formData.get('user_id_text') as string
  redirect(`/${userIdText}`)
}