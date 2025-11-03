export type ArtistLike = { id?: string | null; name?: string | null }

type ArtistRelation<T extends ArtistLike> = { artists_v2: T | T[] | null }

export function getPrimaryArtistFromRelation<T extends ArtistLike>(
  relations: ArtistRelation<T>[] | null | undefined,
): T | null {
  if (!relations || relations.length === 0) {
    return null
  }

  return getFirstFromMaybeArray(relations[0]?.artists_v2)
}

export function getFirstFromMaybeArray<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null
  }

  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null
  }

  return value
}
