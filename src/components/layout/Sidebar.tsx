'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { type Artist } from '@/types'

export default function Sidebar() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<User | null>(null)
  const [favoriteArtists, setFavoriteArtists] = useState<Artist[]>([])
  
  // ユーザー情報とお気に入りアーティストをブラウザ側で取得する
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data } = await supabase
          .from('favorite_artists_v2')
          .select('artists_v2(*)')
          .eq('user_id', user.id)
          .order('sort_order')

        const artists = data
          ?.flatMap(fav => {
            const relation = fav.artists_v2
            if (!relation) return []
            return Array.isArray(relation) ? relation : [relation]
          })
          .filter(Boolean) as Artist[] || []
        setFavoriteArtists(artists)
      }
    }
    fetchData()

    // ログイン状態が変化した時にUIをリアルタイムで更新する
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchData() // ログインしたら再取得
      } else {
        setUser(null)
        setFavoriteArtists([]) // ログアウトしたらクリア
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  // URLから現在のフィルターを取得して、アクティブなリンクを判定
  const currentTab = searchParams.get('tab')
  const currentArtistId = searchParams.get('artistId')

  const linkClasses = (isActive: boolean) => 
    `w-full text-left px-4 py-2 rounded-md ${isActive ? 'bg-gray-200 font-bold' : 'hover:bg-gray-100'}`

  return (
    <aside className="w-full h-screen sticky top-16 p-4 border-r border-gray-200">
      <nav className="flex flex-col space-y-2">
        <h3 className="px-4 text-sm font-semibold text-gray-500">タイムライン</h3>
        <Link href="/" className={linkClasses(!currentTab && !currentArtistId)}>
          すべての投稿
        </Link>
        {user && (
          <Link href="/?tab=following" className={linkClasses(currentTab === 'following')}>
            フォロー中
          </Link>
        )}

        {favoriteArtists.length > 0 && (
          <div className="pt-4">
            <h3 className="px-4 text-sm font-semibold text-gray-500">お気に入りのアーティスト</h3>
            <div className="mt-2 flex flex-col space-y-1">
              {favoriteArtists.map(artist => (
                <Link 
                  key={artist.id} 
                  href={`/?artistId=${artist.id}`} 
                  className={linkClasses(currentArtistId === artist.id)}
                >
                  <div className="flex items-center">
                    {artist.image_url && (
                      <Image src={artist.image_url} alt={artist.name} width={24} height={24} className="rounded-full w-6 h-6 mr-2 object-cover" />
                    )}
                    <span>{artist.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
    </aside>
  )
}