'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { type Tag } from '@/components/post/TagSearch'
import { type SongInsert, type ArtistInsert } from '@/types'
import { type Database } from '@/types/database'

type FavoriteVideoInsert = Database['public']['Tables']['favorite_videos']['Insert']

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
    await supabase.from('favorite_songs_v2').delete().eq('user_id', user.id)
    if (favoriteSongs.length > 0) {
      const artistsForSongsToUpsert: ArtistInsert[] = favoriteSongs
        .filter((s) => s.artistId && s.artistName)
        .map(s => ({
          id: s.artistId!,
          name: s.artistName!,
          image_url: s.imageUrl,
        }))

      const songsToUpsert: SongInsert[] = favoriteSongs.map(s => ({
        id: s.id,
        title: s.name,
        image_url: s.imageUrl,
        spotify_id: s.id,
      }))

      const songArtistLinks = favoriteSongs
        .filter((s) => s.artistId)
        .map((s) => ({ song_id: s.id, artist_id: s.artistId! }))

      const favSongsToInsert = favoriteSongs.map((song, index) => ({
        user_id: user.id,
        song_id: song.id,
        sort_order: index,
      }))

      if (artistsForSongsToUpsert.length > 0) await supabase.from('artists_v2').upsert(artistsForSongsToUpsert)
      if (songsToUpsert.length > 0) await supabase.from('songs_v2').upsert(songsToUpsert)
      if (songArtistLinks.length > 0) await supabase.from('song_artists').upsert(songArtistLinks, { onConflict: 'song_id,artist_id' })
      if (favSongsToInsert.length > 0) await supabase.from('favorite_songs_v2').insert(favSongsToInsert)
    }

    const favoriteArtists: Tag[] = JSON.parse(formData.get('favoriteArtists') as string)
    await supabase.from('favorite_artists_v2').delete().eq('user_id', user.id)
    if (favoriteArtists.length > 0) {
      const artistsToUpsert: ArtistInsert[] = favoriteArtists.map(a => ({ id: a.id, name: a.name, image_url: a.imageUrl }));

      const favArtistsToInsert = favoriteArtists.map((artist, index) => ({
        user_id: user.id,
        artist_id: artist.id,
        sort_order: index
      }));

      if (artistsToUpsert.length > 0) await supabase.from('artists_v2').upsert(artistsToUpsert)
      if (favArtistsToInsert.length > 0) await supabase.from('favorite_artists_v2').insert(favArtistsToInsert)
    }

    const favoriteVideos: Tag[] = JSON.parse((formData.get('favoriteVideos') as string) ?? '[]')
    await supabase.from('favorite_videos').delete().eq('user_id', user.id)
    const videoTags = favoriteVideos.filter(tag => tag.type === 'video')
    if (videoTags.length > 0) {
      const favVideosToInsert: FavoriteVideoInsert[] = videoTags.map((video, index) => ({
        user_id: user.id,
        video_id: video.id,
        sort_order: index,
      }))
      if (favVideosToInsert.length > 0) {
        await supabase.from('favorite_videos').insert(favVideosToInsert)
      }
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