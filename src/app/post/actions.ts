'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { searchTracks, searchArtists } from '@/lib/spotify/api'
import { type ArtistInsert, type SongInsert, type TagInsert } from '@/types'
import { type Tag } from '@/components/post/TagSearch'

// createPost関数を以下のように変更
export async function createPost(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to post.' }

  const content = formData.get('content') as string
  if (!content) return { error: 'Content cannot be empty.' }
  
  // 'tags'というキーで送られてきたJSON文字列を取得
  const tagsJson = formData.get('tags') as string
  const tags: Tag[] = JSON.parse(tagsJson) // JSON文字列をオブジェクトの配列に戻す

  // 1. まず投稿(post)を作成
  const { data: postData, error: postError } = await supabase
    .from('posts')
    .insert({ content: content, user_id: user.id })
    .select().single()

  if (postError) {
    console.error('Error creating post:', postError)
    return { error: 'Failed to create post.' }
  }

  // 2. もしタグがあれば、一つずつ処理してデータベースに保存
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      if (tag.type === 'song') {
        // --- 楽曲タグの処理 ---
        const artist = { id: tag.artistName!, name: tag.artistName! } // 仮のアーティスト情報
        // 2a. アーティストを登録
        await supabase.from('artists').upsert({id: artist.id, name: artist.name})

        // 2b. 曲を登録
        const songToInsert: SongInsert = {
          id: tag.id,
          name: tag.name,
          artist_id: artist.id,
          album_art_url: tag.imageUrl,
        }
        await supabase.from('songs').upsert(songToInsert)

        // 2c. タグを登録
        const tagToInsert: TagInsert = { post_id: postData.id, song_id: tag.id }
        await supabase.from('tags').insert(tagToInsert)

      } else if (tag.type === 'artist') {
        // --- アーティストタグの処理 ---
        // 2a. アーティストを登録
        const artistToInsert: ArtistInsert = { id: tag.id, name: tag.name, image_url: tag.imageUrl }
        await supabase.from('artists').upsert(artistToInsert)
        
        // 2b. タグを登録
        const tagToInsert: TagInsert = { post_id: postData.id, artist_id: tag.id }
        await supabase.from('tags').insert(tagToInsert)
      }
    }
  }

  revalidatePath('/')
}

export async function toggleLike(postId: number) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. 現在のユーザーを取得
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to like a post.' }
  }
  const userId = user.id

  // 2. 既にいいねしているかチェック
  const { data: existingLike, error: checkError } = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single()

  if (checkError && checkError.code !== 'PGRST116') {
    // PGRST116は「行が見つからない」エラーなので、それ以外は問題あり
    console.error('Error checking for likes:', checkError)
    return { error: 'Failed to process like.' }
  }

  // 3. いいねしていたら削除（いいね解除）、していなければ追加
  if (existingLike) {
    // いいね解除
    const { error: deleteError } = await supabase
      .from('likes')
      .delete()
      .eq('id', existingLike.id)
    if (deleteError) {
      console.error('Error unliking post:', deleteError)
      return { error: 'Failed to unlike post.' }
    }
  } else {
    // いいね追加
    const { error: insertError } = await supabase
      .from('likes')
      .insert({ post_id: postId, user_id: userId })
    if (insertError) {
      console.error('Error liking post:', insertError)
      return { error: 'Failed to like post.' }
    }
  }

  // 4. タイムラインのデータを再読み込み
  revalidatePath('/')
}

export async function searchMusic(query: string) {
  if (!query) {
    return []
  }
  try {
    const results = await searchTracks(query)
    return results
  } catch (error) {
    console.error('Spotify search failed:', error)
    return []
  }
}

export async function searchArtistsAction(query: string) {
  if (!query) {
    return []
  }
  try {
    const results = await searchArtists(query)
    return results
  } catch (error) {
    console.error('Spotify artist search failed:', error)
    return []
  }
}

