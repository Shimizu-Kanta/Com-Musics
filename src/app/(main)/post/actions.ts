// src/app/(main)/post/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { searchTracks, searchArtists } from '@/lib/spotify/api'
import { type ArtistInsert, type SongInsert, type TagInsert, type PostWithRelations } from '@/types'
import { type Tag } from '@/components/post/TagSearch'

const POSTS_PER_PAGE = 20;

// Spotify検索関数
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

// いいね機能
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

// ▼▼▼ 投稿作成（動画タグ対応版） ▼▼▼
export async function createPost(content: string, tags: Tag[]) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !content.trim() || content.length > 600) {
    return
  }

  // ▼ 投稿直後にタグの内容をサーバーログへ（any 不使用）
  console.log('=== createPost Debug ===')
  console.log('content length:', content.length)
  console.log(
    'tags:',
    tags.map((t) => ({
      type: t.type,
      id: t.id,
      name: t.name,
      // タグ種別ごとに存在し得るフィールドを安全に参照
      artistId: 'artistId' in t ? t.artistId : undefined,
      artistName: 'artistName' in t ? t.artistName : undefined,
      liveDate: 'liveDate' in t ? t.liveDate : undefined,
      imageUrl: 'imageUrl' in t ? t.imageUrl : undefined,
    })),
  )

  // 1. 投稿作成
  const { data: postData, error: postError } = await supabase
    .from('posts')
    .insert({ content, user_id: user.id })
    .select()
    .single()

  if (postError || !postData) {
    console.error('Error creating post:', postError)
    return
  }

  // 2. タグ保存（既存ロジックそのまま）
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      if (tag.type === 'song') {
        const artistToInsert: ArtistInsert = {
          id: tag.artistId!,
          name: tag.artistName!,
          image_url: tag.imageUrl,
        }
        await supabase.from('artists_v2').upsert(artistToInsert)

        const songToInsert: SongInsert = {
          id: tag.id,
          title: tag.name,
          image_url: tag.imageUrl,
          spotify_id: tag.id,
        }
        await supabase.from('songs_v2').upsert(songToInsert)

        await supabase.from('song_artists').upsert({
          song_id: tag.id,
          artist_id: tag.artistId!,
        }, { onConflict: 'song_id,artist_id' })

        const tagToInsert: TagInsert = { post_id: postData.id, song_id: tag.id }
        await supabase.from('tags_v2').insert(tagToInsert)
      } else if (tag.type === 'artist') {
        const artistToInsert: ArtistInsert = {
          id: tag.id,
          name: tag.name,
          image_url: tag.imageUrl,
        }
        await supabase.from('artists_v2').upsert(artistToInsert)
        const tagToInsert: TagInsert = { post_id: postData.id, artist_id: tag.id }
        await supabase.from('tags_v2').insert(tagToInsert)
      } else if (tag.type === 'live') {
        const tagToInsert: TagInsert = {
          post_id: postData.id,
          live_id: parseInt(String(tag.id), 10),
        }
        await supabase.from('tags_v2').insert(tagToInsert)
      } else if (tag.type === 'video') {
        const tagToInsert: TagInsert = { post_id: postData.id, video_id: tag.id }
        await supabase.from('tags_v2').insert(tagToInsert)
      }
    }
  }

  // 3. パス再検証（ISR/SSRの再取得トリガ）
  revalidatePath('/')
}
// ライブ検索
export async function searchLivesAction(query: string) {
  'use server'
  if (!query) return []
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('lives_v2')
    .select('*, live_artists(*, artists_v2(name))')
    .ilike('name', `%${query}%`)
    .limit(10)

  if (error) {
    console.error('Error searching lives:', error)
    return []
  }
  return data || []
}

// ▼▼▼ 投稿取得（動画タグ対応版） ▼▼▼
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

  // ▼▼▼【修正】動画関連テーブルをSELECT文に追加 ▼▼▼
  let query = supabase
    .from('posts')
    .select(`
      *,
      profiles!inner(*),
      likes(user_id),
      tags:tags_v2(
        *,
        songs_v2(*, song_artists(*, artists_v2(*))),
        artists_v2(*),
        lives_v2(*, live_artists(*, artists_v2(*))),
        videos(*, artists_v2(*))
      )
    `)
    .order('created_at', { ascending: false })
  
  // タイムラインの種類によって問い合わせ内容を切り替え
  if (searchQuery) {
    // 検索クエリがある場合
    query = query.ilike('content', `%${searchQuery}%`).range(from, to)
  } 
  else if (profileUserId) {
    // 特定ユーザーのプロフィールページ
    query = query.eq('user_id', profileUserId).range(from, to)
  }
  else {
    if (tab === 'following' && userId) {
      // フォロー中タブ
      const { data: followingIdsData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', userId)
      const followingIds = followingIdsData?.map(f => f.following_id) ?? []
      if (followingIds.length > 0) {
        query = query.in('user_id', followingIds).range(from, to)
      } else {
        return []
      }
    } else if (artistId) {
      // ▼▼▼【修正】アーティストページ：動画タグも含める ▼▼▼
      const allPostIds = new Set<number>()
      
      // 1. アーティストが直接タグ付けされた投稿
      const { data: directTags } = await supabase
        .from('tags_v2')
        .select('post_id')
        .eq('artist_id', artistId)
      directTags?.forEach(t => allPostIds.add(t.post_id))

      // 2. アーティストの楽曲がタグ付けされた投稿
      const { data: songIdRows } = await supabase
        .from('song_artists')
        .select('song_id')
        .eq('artist_id', artistId)
      const songIds = songIdRows?.map((row) => row.song_id) ?? []
      if (songIds.length > 0) {
        const { data: songTags } = await supabase
          .from('tags_v2')
          .select('post_id')
          .in('song_id', songIds)
        songTags?.forEach(t => allPostIds.add(t.post_id))
      }

      // 3. アーティストのライブがタグ付けされた投稿
      const { data: liveIds } = await supabase
        .from('live_artists')
        .select('live_id')
        .eq('artist_id', artistId)
      if (liveIds && liveIds.length > 0) {
        const { data: liveTags } = await supabase
          .from('tags_v2')
          .select('post_id')
          .in('live_id', liveIds.map(l => l.live_id))
        liveTags?.forEach(t => allPostIds.add(t.post_id))
      }

      // 4. 【新規追加】アーティストの動画がタグ付けされた投稿
      const { data: videoIds } = await supabase
        .from('videos')
        .select('id')
        .eq('artist_id', artistId)
      if (videoIds && videoIds.length > 0) {
        const { data: videoTags } = await supabase
          .from('tags_v2')
          .select('post_id')
          .in('video_id', videoIds.map(v => v.id))
        videoTags?.forEach(t => allPostIds.add(t.post_id))
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
  
  // ▼▼▼ デバッグ用ログ（any → unknown + 型安全な参照に変更） ▼▼▼
  console.log('=== fetchPosts Debug ===')
  console.log('Query params:', { page, userId, tab, artistId, profileUserId, searchQuery })
  console.log('Fetched data:', JSON.stringify(data, null, 2))
  console.log('Error:', error)
  
  if (data && data.length > 0) {
    data.forEach((post, index) => {
      console.log(`Post ${index} tags:`, post.tags)
      post.tags?.forEach((tag: unknown, tagIndex: number) => {
        const t = tag as Record<string, unknown>
        const dbg = {
          song_id: typeof t['song_id'] === 'number' ? (t['song_id'] as number) : undefined,
          artist_id: typeof t['artist_id'] === 'string' ? (t['artist_id'] as string) : undefined,
          live_id: typeof t['live_id'] === 'number' ? (t['live_id'] as number) : undefined,
          video_id:
            typeof t['video_id'] === 'number' || typeof t['video_id'] === 'string'
              ? (t['video_id'] as number | string)
              : undefined,
          has_videos: typeof t['videos'] !== 'undefined',
        }
        console.log(`  Tag ${tagIndex}:`, dbg)
      })
    })
  }
  console.log('========================')
  // ▲▲▲ デバッグ用ログここまで ▲▲▲
  
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
