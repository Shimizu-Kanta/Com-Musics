'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { searchTracks, searchArtists } from '@/lib/spotify/api'
import { type ArtistInsert, type SongInsert, type TagInsert, type PostWithRelations } from '@/types'
import { type Tag } from '@/components/post/TagSearch'

const POSTS_PER_PAGE = 20;

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
  if (!user || !content.trim() || content.length > 600) {
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

export async function fetchPosts({ 
  page = 1, 
  userId, 
  tab, 
  artistId, 
  profileUserId,
  searchQuery
}: { 
  page: number; 
  userId?: string; 
  tab?: string; 
  artistId?: string; 
  profileUserId?: string;
  searchQuery?: string;
}) {
  const supabase = createClient()

  const from = page * POSTS_PER_PAGE;
  const to = from + POSTS_PER_PAGE - 1;

  let query = supabase
    .from('posts')
    .select('*, profiles!inner(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)))')
    .order('created_at', { ascending: false })
  
  // ▼▼▼【重要】ここからが今回の主な修正点です ▼▼▼
  // --- どのタイムラインかによって、問い合わせ内容を切り替える ---
  if (searchQuery) {
    query = query.ilike('content', `%${searchQuery}%`).range(from, to)
  } 
  else if (profileUserId) {
    query = query.eq('user_id', profileUserId).range(from, to)
  }
  else {
    if (tab === 'following' && userId) {
      const { data: followingIdsData } = await supabase.from('followers').select('following_id').eq('follower_id', userId)
      const followingIds = followingIdsData?.map(f => f.following_id) ?? []
      if (followingIds.length > 0) {
        query = query.in('user_id', followingIds).range(from, to)
      } else {
        return []
      }
    } else if (artistId) {
      // --- 賢い調査方法をここに実装 ---
      const allPostIds = new Set<number>()
      // 1. アーティストが直接タグ付けされた投稿
      const { data: directTags } = await supabase.from('tags').select('post_id').eq('artist_id', artistId)
      directTags?.forEach(t => allPostIds.add(t.post_id))
      // 2. アーティストの楽曲がタグ付けされた投稿
      const { data: songIds } = await supabase.from('songs').select('id').eq('artist_id', artistId)
      if (songIds && songIds.length > 0) {
        const { data: songTags } = await supabase.from('tags').select('post_id').in('song_id', songIds.map(s => s.id))
        songTags?.forEach(t => allPostIds.add(t.post_id))
      }
      // 3. アーティストのライブがタグ付けされた投稿
      const { data: liveIds } = await supabase.from('live_artists').select('live_id').eq('artist_id', artistId)
      if (liveIds && liveIds.length > 0) {
        const { data: liveTags } = await supabase.from('tags').select('post_id').in('live_id', liveIds.map(l => l.live_id))
        liveTags?.forEach(t => allPostIds.add(t.post_id))
      }
      
      const uniquePostIds = Array.from(allPostIds)
      if (uniquePostIds.length > 0) {
        query = query.in('id', uniquePostIds).range(from, to)
      } else {
        return []
      }
    } else {
      // 通常のタイムライン
      query = query.range(from, to)
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching more posts:', error)
    return []
  }

  const posts: PostWithRelations[] = (data ?? []).map((post) => ({
    ...post,
    is_liked_by_user:
      !!userId && Array.isArray(post.likes)
        ? post.likes.some((like: { user_id: string }) => like.user_id === userId)
        : false,
  }))
  
  return posts;
}