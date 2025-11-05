'use client'

import { useEffect, useState } from 'react'
import { searchMusic } from '@/app/(main)/post/actions'

type Props = { value: string; onPick: (trackId: string) => void }

export default function MusicSearch({ value, onPick }: Props) {
  const [hits, setHits] = useState<{ id: string; name: string; artist: string }[]>([])
  useEffect(() => {
    let cancel = false
    async function run() {
      if (!value.trim()) { setHits([]); return }
      const res = await searchMusic(value)
      if (!cancel) setHits(res.map(r => ({ id: r.id, name: r.name, artist: r.artist })))
    }
    run()
    return () => { cancel = true }
  }, [value])

  return (
    <ul className="divide-y rounded-md border">
      {hits.map(h => (
        <li key={h.id} className="flex items-center justify-between p-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{h.name}</p>
            <p className="truncate text-xs text-gray-500">{h.artist}</p>
          </div>
          <button className="rounded-md bg-gray-100 px-2 py-1 text-sm" onClick={() => onPick(h.id)}>
            追加
          </button>
        </li>
      ))}
    </ul>
  )
}
