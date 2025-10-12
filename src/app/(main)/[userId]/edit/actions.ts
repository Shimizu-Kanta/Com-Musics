'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { type Tag } from '@/components/post/TagSearch'
import { type SongInsert, type ArtistInsert } from '@/types'
import { type SupabaseClient } from '@supabase/supabase-js'

// ▼▼▼【重要】このuploadImageヘルパー関数は不要になったため、削除します ▼▼▼
// async function uploadImage(...) { ... }

export async function updateProfile(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const userIdText = formData.get('user_id_text') as string

  try {
    // ▼▼▼【重要】formDataからファイルではなく、URLを直接受け取ります ▼▼▼
    const profileData = {
      nickname: formData.get('nickname') as string,
      bio: formData.get('bio') as string,
      user_id_text: userIdText,
      avatar_url: formData.get('avatar_url') as string,
      header_image_url: formData.get('header_image_url') as string, // `header_url`から`header_image_url`に修正
    }

    // (プロフィール更新処理は一切変更ありません)
    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', user.id)
    if (profileError) throw profileError

    // (お気に入り楽曲・アーティストの更新処理は一切変更ありません)
    const favoriteSongs: Tag[] = JSON.parse(formData.get('favoriteSongs') as string)
    await supabase.from('favorite_songs').delete().eq('user_id', user.id)
    if (favoriteSongs.length > 0) {
      const songsToUpsert: SongInsert[] = favoriteSongs.map(s => ({ 
        id: s.id, 
        name: s.name, 
        artist_id: s.artistId!, 
        album_art_url: s.imageUrl 
      }))
      const artistsForSongsToUpsert: ArtistInsert[] = favoriteSongs.map(s => ({
        id: s.artistId!,
        name: s.artistName!
      }))
      
      const favSongsToInsert = favoriteSongs.map((song, index) => ({ 
        user_id: user.id, 
        song_id: song.id, 
        sort_order: index
      }))

      if (artistsForSongsToUpsert.length > 0) await supabase.from('artists').upsert(artistsForSongsToUpsert)
      if (songsToUpsert.length > 0) await supabase.from('songs').upsert(songsToUpsert)
      if (favSongsToInsert.length > 0) await supabase.from('favorite_songs').insert(favSongsToInsert)
    }

    const favoriteArtists: Tag[] = JSON.parse(formData.get('favoriteArtists') as string)
    await supabase.from('favorite_artists').delete().eq('user_id', user.id)
    if (favoriteArtists.length > 0) {
      const artistsToUpsert: ArtistInsert[] = favoriteArtists.map(a => ({ id: a.id, name: a.name, image_url: a.imageUrl }));
      
      const favArtistsToInsert = favoriteArtists.map((artist, index) => ({ 
        user_id: user.id, 
        artist_id: artist.id, 
        sort_order: index
      }));

      if (artistsToUpsert.length > 0) await supabase.from('artists').upsert(artistsToUpsert)
      if (favArtistsToInsert.length > 0) await supabase.from('favorite_artists').insert(favArtistsToInsert)
    }

  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'プロフィールの更新に失敗しました。' }
  }

  // (キャッシュクリアとリダイレクト処理は一切変更ありません)
  revalidatePath(`/${userIdText}`, 'layout')
  redirect(`/${userIdText}`)
}