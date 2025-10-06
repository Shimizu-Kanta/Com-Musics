import { type Database } from './database'

type PostRow = Database['public']['Tables']['posts']['Row']
export type PostInsert = Database['public']['Tables']['posts']['Insert']

type Profile = Database['public']['Tables']['profiles']['Row']

export type Like = Database['public']['Tables']['likes']['Row']

export type SongRow = Database['public']['Tables']['songs']['Row']
export type SongInsert = Database['public']['Tables']['songs']['Insert']

type TagRow = Database['public']['Tables']['tags']['Row']
export type TagInsert = Database['public']['Tables']['tags']['Insert']

export type ArtistInsert = Database['public']['Tables']['artists']['Insert']

// タグと、それに紐づく曲の情報を合わせた型
export type TagWithSong = TagRow & {
  songs: SongRow | null
}

export type PostWithProfile = PostRow & {
  profiles: Pick<Profile, 'nickname' | 'user_id_text'> | null
  likes: Like[]
  is_liked_by_user: boolean
  // 投稿には、曲情報を含んだタグの配列が紐づく
  tags: TagWithSong[]
}