'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import AttendButton from './AttendButton'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid'

type ArtistMini = { id: string; name: string | null; image_url: string | null }

type LiveDate = {
  id: number
  live_date: string | null
  isAttended: boolean
  singleDayArtists: ArtistMini[] // その日だけ出演
}
type Venues = { [venueName: string]: LiveDate[] }

type LiveCardProps = {
  liveName: string
  headerArtists: ArtistMini[]        // 全日程参加アーティスト
  venues: Venues                     // 各日程の「その日だけ出演」
  userLoggedIn: boolean
}

export default function LiveCard({
  liveName,
  headerArtists,
  venues,
  userLoggedIn,
}: LiveCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [openDates, setOpenDates] = useState<Record<number, boolean>>({})

  const toggleDate = (id: number) =>
    setOpenDates(prev => ({ ...prev, [id]: !prev[id] }))

  // 代表アイコン（最大5）
  const topHeader = useMemo(() => headerArtists.slice(0, 5), [headerArtists])
  const extraCount = headerArtists.length > 5 ? headerArtists.length - 5 : 0

  // 既存の新規作成リンク用の代表（先頭）。ヘッダーが空なら日程の最初の人にフォールバック
  const fallbackArtist = useMemo(() => {
    if (headerArtists[0]) return headerArtists[0]
    for (const dates of Object.values(venues)) {
      for (const d of dates) {
        if (d.singleDayArtists[0]) return d.singleDayArtists[0]
      }
    }
    return null
  }, [headerArtists, venues])

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          {/* 全日程参加アーティストのアイコン列 */}
          <div className="flex -space-x-2">
            {topHeader.map((a) => (
              <div key={a.id} className="h-10 w-10 rounded-full overflow-hidden border border-white">
                {a.image_url ? (
                  <Image
                    src={a.image_url}
                    alt={a.name ?? ''}
                    width={40}
                    height={40}
                    className="h-10 w-10 object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 bg-gray-200" />
                )}
              </div>
            ))}
            {extraCount > 0 && (
              <div className="h-10 w-10 rounded-full bg-gray-100 border border-white flex items-center justify-center text-xs">
                +{extraCount}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold">{liveName}</h2>
            {/* 代表名（先頭1名だけ、小さく） */}
            {headerArtists[0]?.name && (
              <p className="text-sm text-gray-500">{headerArtists[0].name}</p>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUpIcon className="w-6 h-6 text-gray-500" />
        ) : (
          <ChevronDownIcon className="w-6 h-6 text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="mt-4 pl-4 border-l-2 border-gray-100">
          {Object.entries(venues).map(([venueName, dates]) => (
            <div key={venueName} className="mt-2 pl-2">
              <h3 className="font-semibold">{venueName}</h3>
              <div className="mt-1 space-y-2 pl-4">
                {dates.map((date) => {
                  const hasSingles = date.singleDayArtists.length > 0
                  const isDateOpen = !!openDates[date.id]
                  return (
                    <div key={date.id}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm">{date.live_date}</p>
                        <div className="flex items-center gap-2">
                          {hasSingles && (
                            <button
                              type="button"
                              onClick={() => toggleDate(date.id)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                              aria-expanded={isDateOpen}
                            >
                              参加アーティスト{isDateOpen ? 'を閉じる' : 'を見る'}
                            </button>
                          )}
                          {userLoggedIn && (
                            <AttendButton
                              liveId={date.id}
                              isInitiallyAttended={date.isAttended}
                            />
                          )}
                        </div>
                      </div>

                      {/* その日限定の出演者一覧（全日程参加の人はここに出さない） */}
                      {hasSingles && isDateOpen && (
                        <div className="mt-2 ml-2 flex flex-wrap gap-3">
                          {date.singleDayArtists.map((a) => (
                            <div key={a.id} className="flex items-center gap-2">
                              {a.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={a.image_url}
                                  alt={a.name ?? ''}
                                  width={24}
                                  height={24}
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                              ) : (
                                <div className="h-6 w-6 rounded-full bg-gray-200" />
                              )}
                              <span className="text-sm text-gray-700">
                                {a.name ?? '（名称未定）'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="mt-4 pt-4 border-t border-dashed">
            {/* 旧仕様互換：代表（先頭）をクエリに入れる。無ければ空で遷移 */}
            <Link
              href={`/live/new?name=${encodeURIComponent(liveName)}&artistId=${encodeURIComponent(
                fallbackArtist?.id ?? ''
              )}&artistName=${encodeURIComponent(fallbackArtist?.name ?? '')}`}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              + このツアーに公演を追加する
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
