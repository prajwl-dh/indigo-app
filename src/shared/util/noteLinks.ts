/**
 * Wiki links are ordinary BlockNote links with an Indigo-owned scheme. Keeping
 * the destination in the href means the link survives a round trip through the
 * block document without adding a second kind of content to the schema.
 */

export const NOTE_LINK_PREFIX = 'indigo:note/'

type UnknownRecord = Record<string, unknown>

export function noteHref(noteId: string): string {
    return `${NOTE_LINK_PREFIX}${encodeURIComponent(noteId)}`
}

export function noteIdFromHref(href: string | undefined | null): string | null {
    if (!href || !href.startsWith(NOTE_LINK_PREFIX)) return null
    const encoded = href.slice(NOTE_LINK_PREFIX.length).split(/[?#]/, 1)[0]
    if (!encoded) return null

    try {
        return decodeURIComponent(encoded)
    } catch {
        return encoded
    }
}

function inlineText(content: unknown): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) return content.map(inlineText).join('')
    if (!content || typeof content !== 'object') return ''

    const value = content as UnknownRecord
    if (typeof value.text === 'string') return value.text
    return inlineText(value.content)
}

function walkLinks(value: unknown, links: Map<string, string>): void {
    if (Array.isArray(value)) {
        for (const entry of value) walkLinks(entry, links)
        return
    }
    if (!value || typeof value !== 'object') return

    const record = value as UnknownRecord
    const href = typeof record.href === 'string' ? record.href : null
    const noteId = noteIdFromHref(href)

    if (noteId && !links.has(noteId)) {
        const text = inlineText(record.content).replace(/\s+/g, ' ').trim()
        links.set(noteId, text)
    }

    for (const key of ['content', 'children', 'rows', 'cells'] as const) {
        if (record[key]) walkLinks(record[key], links)
    }
}

/**
 * Every note this document points at, in the order the links appear. The text
 * is kept so a backlink can fall back to the link label when a note is gone.
 */
export function extractNoteLinks(body: string | undefined | null): Array<{
    noteId: string
    text: string
}> {
    if (!body || body.trim() === '') return []

    let parsed: unknown
    try {
        parsed = JSON.parse(body)
    } catch {
        return []
    }

    const links = new Map<string, string>()
    walkLinks(parsed, links)
    return Array.from(links, ([noteId, text]) => ({ noteId, text }))
}

export function extractNoteLinkIds(body: string | undefined | null): string[] {
    return extractNoteLinks(body).map((link) => link.noteId)
}
