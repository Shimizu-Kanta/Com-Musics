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

  const userIdText = formData.get('user_id_text') as string

  try {
    const nickname = formData.get('nickname') as string
    const bio = formData.get('bio') as string
    const avatarFile = formData.get('avatar') as File | null
    const headerFile = formData.get('header') as File | null
    const favoriteSongs: Tag[] = JSON.parse(formData.get('favoriteSongs') as string)
    const favoriteArtists: Tag[] = JSON.parse(formData.get('favoriteArtists') as string)
    
    const profileUpdateData: { nickname: string; bio: string; avatar_url?: string | null; header_image_url?: string | null } = { nickname, bio }
    if (avatarFile && avatarFile.size > 0) profileUpdateData.avatar_url = await uploadImage(supabase, user.id, avatarFile, 'avatar')
    if (headerFile && headerFile.size > 0) profileUpdateData.header_image_url = await uploadImage(supabase, user.id, headerFile, 'header')
    
    const { error: profileError } = await supabase.from('profiles').update(profileUpdateData).eq('id', user.id)
    if (profileError) throw profileError

    // --- お気に入り曲の更新 ---
    await supabase.from('favorite_songs').delete().eq('user_id', user.id)
    if (favoriteSongs.length > 0) {
      const artistsToUpsert = Array.from(new Map(favoriteSongs.filter(s => s.artistId).map(s => [s.artistId!, { id: s.artistId!, name: s.artistName! }])).values());
      const songsToUpsert: SongInsert[] = favoriteSongs.map(s => ({ id: s.id, name: s.name, artist_id: s.artistId!, album_art_url: s.imageUrl }));
      
      // ▼▼▼【重要】並び順（sort_order）を追加します ▼▼▼
      const favSongsToInsert = favoriteSongs.map((song, index) => ({ 
        user_id: user.id, 
        song_id: song.id, 
        sort_order: index // 配列のインデックスを順番として保存
      }))

      if (artistsToUpsert.length > 0) await supabase.from('artists').upsert(artistsToUpsert)
      if (songsToUpsert.length > 0) await supabase.from('songs').upsert(songsToUpsert)
      if (favSongsToInsert.length > 0) await supabase.from('favorite_songs').insert(favSongsToInsert)
    }

    // --- お気に入りアーティストの更新 ---
    await supabase.from('favorite_artists').delete().eq('user_id', user.id)
    if (favoriteArtists.length > 0) {
      const artistsToUpsert: ArtistInsert[] = favoriteArtists.map(a => ({ id: a.id, name: a.name, image_url: a.imageUrl }));
      
      // ▼▼▼【重要】こちらにも並び順（sort_order）を追加します ▼▼▼
      const favArtistsToInsert = favoriteArtists.map((artist, index) => ({ 
        user_id: user.id, 
        artist_id: artist.id, 
        sort_order: index // 配列のインデックスを順番として保存
      }));

      if (artistsToUpsert.length > 0) await supabase.from('artists').upsert(artistsToUpsert)
      if (favArtistsToInsert.length > 0) await supabase.from('favorite_artists').insert(favArtistsToInsert)
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '不明なエラーが発生しました。'
    console.error('Update Profile Error:', message)
    return { error: `プロフィールの更新に失敗しました。\n\n詳細: ${message}` }
  }
  
  revalidatePath(`/${userIdText}`)
  revalidatePath(`/${userIdText}/edit`)
  redirect(`/${userIdText}`)
}