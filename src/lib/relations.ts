export type ArtistLike = { id?: string | null; name?: string | null }

type ArtistRelation<T extends ArtistLike> = { artists_v2: T | T[] | null }

export function getPrimaryArtistFromRelation<T extends ArtistLike>(
  relations: ArtistRelation<T>[] | null | undefined,
): T | null {
  if (!relations || relations.length === 0) {
    return null
  }

  const value = relations[0]?.artists_v2
  if (!value) return null

  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null
  }

  return value
}
