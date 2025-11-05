'use client'

import { useMemo, useState, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client' // ブラウザ用クライアント
import { createLive } from '@/app/(main)/live/actions'
import TagSearch, { type Tag } from '@/components/post/TagSearch'

type LiveActionIssue = { field: string; code: string; message: string }
type LiveActionState = { error?: string; success?: string; errors?: LiveActionIssue[] } | null

type SelectedArtist =
  | { key: string; kind: 'db'; name: string; imageUrl?: string | null; dbId: string }
  | { key: string; kind: 'spotify'; name: string; imageUrl?: string | null; spotifyId: string }

// 小ユーティリティ
function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ')
}
function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}
function isSpotifyId(s: string) {
  return /^[0-9A-Za-z]{22}$/.test(s)
}
function getStringProp(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[key]
    return typeof v === 'string' ? v : undefined
  }
  return undefined
}
function getId(obj: unknown): string | undefined {
  return getStringProp(obj, 'id')
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? '作成中…' : 'ライブを作成'}
    </button>
  )
}

export default function NewLiveForm({ venues }: { venues: string[] }) {
  const searchParams = useSearchParams()
  const prefilledName = searchParams.get('name') || ''

  // 旧導線からの初期指定（DB既存を想定）
  const preArtistId = searchParams.get('artistId')
  const preArtistName = searchParams.get('artistName') || ''
  const preArtistImage = searchParams.get('artistImageUrl')

  const [selected, setSelected] = useState<SelectedArtist[]>(
    preArtistId
      ? [{
          key: `db:${preArtistId}`,
          kind: 'db',
          name: preArtistName || preArtistId,
          imageUrl: preArtistImage || undefined,
          dbId: preArtistId,
        }]
      : []
  )

  const [actionState, formAction] = useActionState<LiveActionState, FormData>(createLive, null)

  // フィールド別エラー
  const fieldErrors = useMemo(() => {
    const map = new Map<string, LiveActionIssue[]>()
    for (const issue of actionState?.errors ?? []) {
      const key = issue.field || '(form)'
      const arr = map.get(key) ?? []
      arr.push(issue)
      map.set(key, arr)
    }
    return map
  }, [actionState?.errors])
  const hasErr = (f: string) => (fieldErrors.get(f)?.length ?? 0) > 0

  // Spotify検索の選択ハンドラ（TagSearch）
  const handleTagSelect = async (tag: Tag) => {
    const tagId = getId(tag)
    const name =
      getStringProp(tag, 'name') ??
      getStringProp(tag, 'label') ??
      (tagId ?? '')
    const imageUrl =
      getStringProp(tag, 'imageUrl') ??
      getStringProp(tag, 'image_url')

    // 明示の spotifyId があれば優先、無ければ id が22桁ならSpotify ID扱い
    const spotifyIdFromProp = getStringProp(tag, 'spotifyId')
    const spotifyId = spotifyIdFromProp ?? (tagId && isSpotifyId(tagId) ? tagId : null)

    // id が UUID なら DBレコードとして追加
    const dbId = tagId && isUUID(tagId) ? tagId : null
    if (dbId) {
      setSelected((prev) => {
        if (prev.some((p) => p.kind === 'db' && p.dbId === dbId)) return prev
        return [...prev, { key: `db:${dbId}`, kind: 'db', name, imageUrl, dbId }]
      })
      return
    }

    // Spotify ID → DBに存在すれば DB として、無ければ Spotifyとして保持
    if (spotifyId) {
      const supabase = createClient()
      const { data: exists } = await supabase
        .from('artists_v2')
        .select('id, name, image_url')
        .eq('spotify_id', spotifyId)
        .maybeSingle()

      if (exists?.id) {
        setSelected((prev) => {
          if (prev.some((p) => p.kind === 'db' && p.dbId === exists.id)) return prev
          return [
            ...prev,
            {
              key: `db:${exists.id}`,
              kind: 'db',
              name: exists.name ?? name,
              imageUrl: exists.image_url ?? imageUrl,
              dbId: exists.id,
            },
          ]
        })
      } else {
        setSelected((prev) => {
          if (prev.some((p) => p.kind === 'spotify' && p.spotifyId === spotifyId)) return prev
          return [...prev, { key: `sp:${spotifyId}`, kind: 'spotify', name, imageUrl, spotifyId }]
        })
      }
    }
  }

  const removeSelected = (key: string) => {
    setSelected((prev) => prev.filter((x) => x.key !== key))
  }

  const hasAtLeastOneArtist = selected.length > 0

  return (
    <form action={formAction} className="space-y-6">
      {/* トップエラー */}
      {actionState?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">{actionState.error}</p>
        </div>
      )}

      {/* ライブ名 */}
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
          ライブ名 <span className="text-red-500">*</span>
        </label>
        <input
          id="name" name="name" type="text" defaultValue={prefilledName} required
          aria-invalid={hasErr('name')}
          className={clsx('w-full rounded-md border p-2 shadow-sm', hasErr('name') ? 'border-red-300 focus:border-red-400' : 'border-gray-300')}
          placeholder="例: Summer Night Tour 2025"
        />
      </div>

      {/* アーティスト（Spotify検索 → 選択 → hidden送信） */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          アーティスト（複数可） <span className="text-red-500">*</span>
        </label>

        {selected.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {selected.map((s) => (
              <li key={s.key} className="flex items-center gap-2 rounded-full border px-2 py-1">
                {s.imageUrl ? (
                  <Image src={s.imageUrl} alt={s.name} width={20} height={20} className="rounded-full" />
                ) : null}
                <span className="text-sm">{s.name}</span>
                <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-600">
                  {s.kind === 'db' ? 'DB' : 'Spotify'}
                </span>
                <button type="button" onClick={() => removeSelected(s.key)}
                  className="text-xs text-gray-500 hover:text-gray-700" aria-label={`${s.name} を外す`}>
                  ×
                </button>

                {/* 送信用 hidden */}
                {s.kind === 'db' && (
                  <input type="hidden" name="artistDbIds[]" value={s.dbId} />
                )}
                {s.kind === 'spotify' && (
                  <>
                    <input type="hidden" name="artistSpotifyIds[]" value={s.spotifyId} />
                    <input type="hidden" name="artistNames[]" value={s.name} />
                    <input type="hidden" name="artistImages[]" value={s.imageUrl ?? ''} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <TagSearch searchOnly="artist" onTagSelect={handleTagSelect} onClose={() => {}} onVideoUrlSubmit={() => {}} />

        {!hasAtLeastOneArtist && (
          <p className="mt-1 text-xs text-amber-600">最低1組以上のアーティストを選択してください。</p>
        )}
      </div>

      {/* 会場 */}
      <div>
        <label htmlFor="venue" className="mb-1 block text-sm font-medium text-gray-700">
          会場 <span className="text-red-500">*</span>
        </label>
        <input
          id="venue" name="venue" required aria-invalid={hasErr('venue')}
          className={clsx('w-full rounded-md border p-2 shadow-sm', hasErr('venue') ? 'border-red-300 focus:border-red-400' : 'border-gray-300')}
          list="venue-list"
        />
        <datalist id="venue-list">
          {venues.map((v) => <option key={v} value={v} />)}
        </datalist>
      </div>

      {/* 日付 */}
      <div>
        <label htmlFor="date" className="mb-1 block text-sm font-medium text-gray-700">
          公演日 <span className="text-red-500">*</span>
        </label>
        <input
          id="date" name="date" type="date" required aria-invalid={hasErr('date')}
          className={clsx('w-full rounded-md border p-2 shadow-sm', hasErr('date') ? 'border-red-300 focus:border-red-400' : 'border-gray-300')}
        />
      </div>

      {/* 説明（任意） */}
      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">説明</label>
        <textarea id="description" name="description" rows={4}
          className="w-full rounded-md border border-gray-300 p-2 shadow-sm" placeholder="イベントの詳細メモなど" />
      </div>

      <SubmitButton />
    </form>
  )
}
