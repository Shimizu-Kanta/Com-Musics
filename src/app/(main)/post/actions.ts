'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { searchTracks, searchArtists } from '@/lib/spotify/api'
import { type ArtistInsert, type SongInsert, type TagInsert } from '@/types'
import { type Tag } from '@/components/post/TagSearch'

// (searchMusic, searchArtistsAction, toggleLike 関数は変更ありません)
export async function searchMusic(query: string) {
  if (!query) return []
  try {
    const results = await searchTracks(query)
    return results
  } catch (error) {
    console.error('Spotify search failed:', error)
    return []
  }
}
export async function searchArtistsAction(query: string) {
  if (!query) return []
  try {
    const results = await searchArtists(query)
    return results
  } catch (error) {
    console.error('Spotify artist search failed:', error)
    return []
  }
}
export async function toggleLike(postId: number) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: like } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .single()

  if (like) {
    await supabase.from('likes').delete().eq('id', like.id)
  } else {
    await supabase.from('likes').insert({ user_id: user.id, post_id: postId })
  }
  revalidatePath('/')
}

// ▼▼▼【重要】createPost関数を、2つの引数を受け取る正しい形に修正します ▼▼▼
export async function createPost(content: string, tags: Tag[]) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !content.trim()) {
    return
  }

  // 1. 投稿をpostsテーブルに挿入
  const { data: postData, error: postError } = await supabase
    .from('posts')
    .insert({ content, user_id: user.id })
    .select()
    .single()

  if (postError || !postData) {
    console.error('Error creating post:', postError)
    return
  }

  // 2. タグが存在する場合、関連テーブルにデータを保存
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      if (tag.type === 'song') {
        const artistToInsert: ArtistInsert = { id: tag.artistId!, name: tag.artistName! }
        await supabase.from('artists').upsert(artistToInsert)
        const songToInsert: SongInsert = { id: tag.id, name: tag.name, artist_id: tag.artistId!, album_art_url: tag.imageUrl }
        await supabase.from('songs').upsert(songToInsert)
        const tagToInsert: TagInsert = { post_id: postData.id, song_id: tag.id }
        await supabase.from('tags').insert(tagToInsert)
      } else if (tag.type === 'artist') {
        const artistToInsert: ArtistInsert = { id: tag.id, name: tag.name, image_url: tag.imageUrl }
        await supabase.from('artists').upsert(artistToInsert)
        const tagToInsert: TagInsert = { post_id: postData.id, artist_id: tag.id }
        await supabase.from('tags').insert(tagToInsert)
      } else if (tag.type === 'live') {
        const tagToInsert: TagInsert = { post_id: postData.id, live_id: parseInt(tag.id, 10) }
        await supabase.from('tags').insert(tagToInsert)
      }
    }
  }

  revalidatePath('/')
}

// (searchLivesAction 関数は変更ありません)
export async function searchLivesAction(query: string) {
  'use server'
  if (!query) return []
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('lives')
    .select('*, artists(name)')
    .ilike('name', `%${query}%`)
    .limit(10)

  if (error) {
    console.error('Error searching lives:', error)
    return []
  }
  return data || []
}