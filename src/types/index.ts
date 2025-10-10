import { type Database } from './database'

export type Profile = Database['public']['Tables']['profiles']['Row'] & {
  avatar_url: string | null
  header_image_url: string | null
}
export type Post = Database['public']['Tables']['posts']['Row']
export type Like = Database['public']['Tables']['likes']['Row']
export type Tag = Database['public']['Tables']['tags']['Row']
export type Song = Database['public']['Tables']['songs']['Row']
export type Artist = Database['public']['Tables']['artists']['Row']
export type Live = Database['public']['Tables']['lives']['Row']
export type Attendee = Database['public']['Tables']['attended_lives']['Row']
export type SongInsert = Database['public']['Tables']['songs']['Insert']
export type ArtistInsert = Database['public']['Tables']['artists']['Insert']
export type TagInsert = Database['public']['Tables']['tags']['Insert']

export type TagWithRelations = Tag & {
  songs: (Song & { artists: { id: string; name: string | null } | null }) | null
  artists: Artist | null
  lives: Live | null
}
export type PostWithRelations = Post & {
  profiles: Profile | null
  likes: Pick<Like, 'user_id'>[]
  tags: TagWithRelations[]
  is_liked_by_user: boolean
}
export type LiveWithRelations = Live & {
  artists: { name:string | null; image_url: string | null } | null
  attended_lives: Pick<Attendee, 'user_id'>[]
}