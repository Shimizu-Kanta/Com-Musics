'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  HomeIcon,
  TicketIcon,
  UserCircleIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { type Artist } from '@/types'
import { useSidebar } from '@/components/layout/SidebarContext'

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')

export default function Sidebar() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { isCollapsed, toggleCollapse, setCollapsed, isMobileOpen, closeMobile } = useSidebar()

  const [user, setUser] = useState<User | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [favoriteArtists, setFavoriteArtists] = useState<Artist[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const [{ data: profile }, { data }] = await Promise.all([
          supabase.from('profiles').select('user_id_text').eq('id', user.id).single(),
          supabase
            .from('favorite_artists')
            .select('artists(*)')
            .eq('user_id', user.id)
            .order('sort_order'),
        ])

        setProfileUserId(profile?.user_id_text ?? null)

        const artists = data?.flatMap(fav => fav.artists).filter(Boolean) as Artist[] || []
        setFavoriteArtists(artists)
      } else {
        setProfileUserId(null)
        setFavoriteArtists([])
      }
    }

    fetchData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchData()
      } else {
        setUser(null)
        setProfileUserId(null)
        setFavoriteArtists([])
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (isMobileOpen) {
      setCollapsed(false)
    }
  }, [isMobileOpen, setCollapsed])

  const currentTab = searchParams.get('tab')
  const currentArtistId = searchParams.get('artistId')

  useEffect(() => {
    if (isMobileOpen) {
      closeMobile()
    }
  }, [pathname, isMobileOpen, closeMobile])

  const timelineItems = useMemo(
    () => [
      {
        key: 'all',
        href: '/',
        label: 'すべての投稿',
        icon: HomeIcon,
        isActive: !currentTab && !currentArtistId,
        visible: true,
      },
      {
        key: 'following',
        href: '/?tab=following',
        label: 'フォロー中',
        icon: UsersIcon,
        isActive: currentTab === 'following',
        visible: Boolean(user),
      },
    ],
    [currentArtistId, currentTab, user],
  )

  const secondaryItems = useMemo(
    () => [
      {
        key: 'live',
        href: '/live',
        label: 'ライブ一覧',
        icon: TicketIcon,
        isActive: pathname?.startsWith('/live') ?? false,
        visible: true,
      },
      {
        key: 'profile',
        href: profileUserId ? `/${profileUserId}` : '/',
        label: 'プロフィール',
        icon: UserCircleIcon,
        isActive: Boolean(profileUserId && pathname === `/${profileUserId}`),
        visible: Boolean(profileUserId),
      },
    ],
    [pathname, profileUserId],
  )

  const renderNavContent = (showLabels: boolean, variant: 'desktop' | 'mobile') => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'mb-6 flex items-center',
          showLabels ? 'justify-between' : 'justify-center',
        )}
      >
        <button
          type="button"
          onClick={toggleCollapse}
          className={cn(
            'flex items-center rounded-md border border-gray-200 px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
            showLabels ? 'w-auto' : 'w-full justify-center',
          )}
          aria-label={isCollapsed ? 'サイドバーを展開する' : 'サイドバーを折りたたむ'}
        >
          {isCollapsed ? (
            <ChevronDoubleRightIcon className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ChevronDoubleLeftIcon className="h-5 w-5" aria-hidden="true" />
          )}
          {showLabels && <span className="ml-2">{isCollapsed ? '展開' : '折りたたむ'}</span>}
        </button>
        {variant === 'mobile' && (
          <button
            type="button"
            onClick={closeMobile}
            className="ml-2 rounded-md p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="サイドバーを閉じる"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        <div>
          {showLabels && (
            <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">タイムライン</h3>
          )}
          <div className="mt-2 flex flex-col space-y-1">
            {timelineItems
              .filter(item => item.visible)
              .map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={variant === 'mobile' ? closeMobile : undefined}
                    className={cn(
                      'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                      item.isActive
                        ? 'bg-indigo-50 font-semibold text-indigo-600'
                        : 'text-gray-700 hover:bg-gray-100',
                      showLabels ? 'justify-start' : 'justify-center',
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {showLabels && <span className="ml-3">{item.label}</span>}
                  </Link>
                )
              })}
          </div>
        </div>

        <div>
          {showLabels && (
            <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">リンク</h3>
          )}
          <div className="mt-2 flex flex-col space-y-1">
            {secondaryItems
              .filter(item => item.visible)
              .map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={variant === 'mobile' ? closeMobile : undefined}
                    className={cn(
                      'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                      item.isActive
                        ? 'bg-indigo-50 font-semibold text-indigo-600'
                        : 'text-gray-700 hover:bg-gray-100',
                      showLabels ? 'justify-start' : 'justify-center',
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {showLabels && <span className="ml-3">{item.label}</span>}
                  </Link>
                )
              })}
          </div>
        </div>

        {favoriteArtists.length > 0 && (
          <div>
            {showLabels && (
              <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">お気に入りのアーティスト</h3>
            )}
            <div className="mt-2 flex flex-col space-y-1">
              {favoriteArtists.map(artist => {
                const artistId = String(artist.id)
                const isActive = currentArtistId === artistId
                return (
                  <Link
                    key={artist.id}
                    href={`/?artistId=${artistId}`}
                    onClick={variant === 'mobile' ? closeMobile : undefined}
                    className={cn(
                      'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-indigo-50 font-semibold text-indigo-600'
                        : 'text-gray-700 hover:bg-gray-100',
                      showLabels ? 'justify-start' : 'justify-center',
                    )}
                  >
                    {artist.image_url ? (
                      <Image
                        src={artist.image_url}
                        alt={artist.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                        {artist.name.charAt(0)}
                      </div>
                    )}
                    {showLabels && <span className="ml-3 truncate">{artist.name}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </nav>
    </div>
  )

  const desktopShouldShowLabels = !isCollapsed

  return (
    <>
      <aside
        className={cn(
          'hidden md:flex md:flex-col md:border-r md:border-gray-200 md:bg-white md:p-4 md:pt-6',
          'md:sticky md:top-16 md:h-[calc(100vh-4rem)]',
          desktopShouldShowLabels ? 'md:w-64' : 'md:w-20',
        )}
      >
        {renderNavContent(desktopShouldShowLabels, 'desktop')}
      </aside>

      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:hidden',
          isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden="true"
        onClick={closeMobile}
      />

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform bg-white p-4 pt-6 shadow-xl transition-transform duration-200 md:hidden',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {renderNavContent(true, 'mobile')}
      </div>
    </>
  )
}
