'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { searchTracks, searchArtists } from '@/lib/spotify/api'
import { type ArtistInsert, type SongInsert, type TagInsert } from '@/types'
import { type Tag } from '@/components/post/TagSearch'

// searchMusic関数
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

// searchArtistsAction関数
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

// toggleLike関数 (変更なし)
export async function toggleLike(postId: number) {
  const supabase = createClient()

  // 1. ログイン中のユーザー情報を取得
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  // 2. ユーザーが既にその投稿を「いいね」しているか確認
  const { data: like, error } = await supabase
    .from('likes')
    .select('*')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking like:', error)
    return
  }

  // 3. もし「いいね」が既にあれば、それを削除（いいね解除）
  if (like) {
    await supabase.from('likes').delete().match({ id: like.id })
  }
  // 4. もし「いいね」がなければ、新しく追加（いいねする）
  else {
    await supabase.from('likes').insert({ user_id: user.id, post_id: postId })
  }

  // 5. ページの表示を更新
  revalidatePath('/')
}

// createPost関数 (ここを最終版に修正)
export async function createPost(formData: FormData) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to post.' }

  const content = formData.get('content') as string
  if (!content) return { error: 'Content cannot be empty.' }

  const tagsJson = formData.get('tags') as string
  const tags: Tag[] = JSON.parse(tagsJson)

  // 1. 投稿を作成
  const { data: postData, error: postError } = await supabase
    .from('posts')
    .insert({ content: content, user_id: user.id })
    .select()
    .single()

  if (postError) {
    console.error('Error creating post:', postError)
    return { error: 'Failed to create post.' }
  }

  // 2. タグがあれば処理
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      if (tag.type === 'song') {
        // --- 楽曲タグの処理 (お気に入り処理とロジックを統一) ---
        // 2a. 親であるアーティストを登録
        await supabase.from('artists').upsert({ id: tag.artistId!, name: tag.artistName! })

        // 2b. 子である曲を登録
        const songToInsert: SongInsert = {
          id: tag.id,
          name: tag.name,
          artist_id: tag.artistId!,
          album_art_url: tag.imageUrl,
        }
        await supabase.from('songs').upsert(songToInsert)

        // 2c. タグを登録
        const tagToInsert: TagInsert = { post_id: postData.id, song_id: tag.id }
        await supabase.from('tags').insert(tagToInsert)

      } else if (tag.type === 'artist') {
        // --- アーティストタグの処理 ---
        const artistToInsert: ArtistInsert = { id: tag.id, name: tag.name, image_url: tag.imageUrl }
        await supabase.from('artists').upsert(artistToInsert)
        const tagToInsert: TagInsert = { post_id: postData.id, artist_id: tag.id }
        await supabase.from('tags').insert(tagToInsert)
      } else if (tag.type === 'live') {
        const tagToInsert: TagInsert = {
          post_id: postData.id,
          live_id: parseInt(tag.id, 10), // idを数値に変換
        }
        await supabase.from('tags').insert(tagToInsert)
      }
    }
  }

  revalidatePath('/')
}

// ライブ情報を検索するサーバーアクション
export async function searchLivesAction(query: string) {
  'use server'
  if (!query) return []
  const supabase = createClient()
  
  // artistsテーブルと結合し、関連するアーティスト名も一緒に取得します
  const { data, error } = await supabase
    .from('lives')
    .select('*, artists(name)') // artists(name) を追加
    .ilike('name', `%${query}%`)
    .limit(10)

  if (error) {
    console.error('Error searching lives:', error)
    return []
  }
  return data || []
}