export const MAX_TAG_LENGTH = 32

/** A note can carry this many tags before the picker stops offering more. */
export const MAX_TAGS_PER_NOTE = 24

/** A tag keeps the casing the user typed, but whitespace and a leading # are normalised. */
export function normalizeTagName(value: string): string {
    return value.replace(/\s+/g, ' ').trim().replace(/^#+/, '').slice(0, MAX_TAG_LENGTH).trim()
}

export function sameTag(a: string, b: string): boolean {
    return a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0
}

export function findTag(tags: string[], value: string): string | undefined {
    return tags.find((tag) => sameTag(tag, value))
}
