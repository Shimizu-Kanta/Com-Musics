import { type Database } from './database'

export type Profile = Database['public']['Tables']['profiles']['Row'] & {
  avatar_url: string | null
  header_image_url: string | null
}
export type Post = Database['public']['Tables']['posts']['Row']
export type Like = Database['public']['Tables']['likes']['Row']
export type Tag = Database['public']['Tables']['tags_v2']['Row']
export type Song = Database['public']['Tables']['songs_v2']['Row']
export type Artist = Database['public']['Tables']['artists_v2']['Row']
export type Live = Database['public']['Tables']['lives_v2']['Row']
export type Attendee = Database['public']['Tables']['attended_lives_v2']['Row']
export type SongInsert = Database['public']['Tables']['songs_v2']['Insert']
export type ArtistInsert = Database['public']['Tables']['artists_v2']['Insert']
export type TagInsert = Database['public']['Tables']['tags_v2']['Insert']
export type Video = Database['public']['Tables']['videos']['Row']

export type SongWithArtists = Song & {
  song_artists: { artists_v2: Artist | null }[] | null
}

export type LiveWithArtists = Live & {
  live_artists: { artists_v2: Artist | null }[] | null
  attended_lives_v2?: Pick<Attendee, 'user_id'>[]
}

export type VideoWithArtist = Video & {
  artists_v2: Artist | null
}

export type TagWithRelations = Tag & {
  songs_v2: SongWithArtists | null
  artists_v2: Artist | null
  lives_v2: LiveWithArtists | null
  videos: VideoWithArtist | null
}

export type PostWithRelations = Post & {
  profiles: Profile | null
  likes: Pick<Like, 'user_id'>[]
  tags: TagWithRelations[]
  is_liked_by_user: boolean
}

export type LiveWithRelations = LiveWithArtists & {
  attended_lives_v2: Pick<Attendee, 'user_id'>[]
}