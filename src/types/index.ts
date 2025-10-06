import { type Database } from './database'

// Supabaseが自動生成した型を元に、扱いやすいように新しい型を定義
type Post = Database['public']['Tables']['posts']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
export type Like = Database['public']['Tables']['likes']['Row']

// 投稿データ(Post)に、プロフィール情報(Profile)の一部を結合させた新しい型
export type PostWithProfile = Post & {
  profiles: Pick<Profile, 'nickname' | 'user_id_text'> | null
  likes: Like[] // いいねの配列
  is_liked_by_user: boolean // 自分がいいねしているかどうかのフラグ
}