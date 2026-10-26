import type { PartialBlock } from '@blocknote/core'

type UnknownRecord = Record<string, unknown>

function readInline(value: unknown): string {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.map(readInline).join(' ')
    if (!value || typeof value !== 'object') return ''

    const record = value as UnknownRecord

    if (typeof record.text === 'string') return record.text

    let text = ''
    for (const key of ['content', 'children', 'rows', 'cells'] as const) {
        if (record[key]) text += ` ${readInline(record[key])}`
    }

    if (record.props && typeof record.props === 'object') {
        const props = record.props as UnknownRecord
        for (const key of ['caption', 'name'] as const) {
            if (typeof props[key] === 'string' && props[key]) text += ` ${props[key]}`
        }
    }

    return text
}

function readBlocks(value: unknown): string {
    if (Array.isArray(value)) return value.map(readBlocks).join(' ')
    if (!value || typeof value !== 'object') return ''
    return readInline(value)
}

const NON_TEXT_BLOCK_TYPES = new Set(['image', 'video', 'audio', 'file', 'table', 'divider'])

function blockIsEmpty(block: PartialBlock): boolean {
    const content = block.content
    const children = block.children

    // Media blocks keep their payload in props rather than content.
    if (typeof block.type === 'string' && NON_TEXT_BLOCK_TYPES.has(block.type)) return false

    if (typeof content === 'string') {
        // Code blocks store their text as a plain string.
        if (content.trim().length > 0) return false
    } else if (Array.isArray(content)) {
        if (readInline(content).trim().length > 0) return false
    } else if (content && typeof content === 'object') {
        // Media, tables and other non-inline blocks count as content.
        return false
    }

    if (Array.isArray(children) && children.length > 0) {
        return children.every((child) => blockIsEmpty(child))
    }

    return true
}

const textCache = new Map<string, string>()

/**
 * The slash trigger on its own is an editing state, not content: BlockNote
 * puts "/" in the paragraph before the writer has picked a block type. It
 * should never become a note title, even if the draft is left mid-command.
 */
const LONE_SLASH_TRIGGER = /^\/\s*$/

/**
 * Parses a BlockNote document without instantiating an editor. Used for search,
 * excerpts and word counts. Documents are immutable strings, so the result is
 * cached for list rendering.
 */
export function extractPlainText(body: string | undefined | null): string {
    if (!body || body.trim() === '') return ''

    const cached = textCache.get(body)
    if (cached !== undefined) return cached

    let text = ''
    try {
        const parsed = JSON.parse(body) as PartialBlock[]
        text = readBlocks(parsed).replace(/\s+/g, ' ').trim()
    } catch {
        text = ''
    }

    if (textCache.size >= 240) {
        const oldest = textCache.keys().next()
        if (!oldest.done) textCache.delete(oldest.value)
    }
    textCache.set(body, text)
    return text
}

export function isBlockDocumentEmpty(body: string | undefined | null): boolean {
    if (!body || body.trim() === '') return true

    try {
        const blocks = JSON.parse(body) as PartialBlock[]
        if (!Array.isArray(blocks)) return true
        return blocks.every((block) => blockIsEmpty(block))
    } catch {
        return false
    }
}

/**
 * Every saved note needs a title. When the writer leaves the title empty but
 * has written a body, the opening words become the title instead of losing the
 * note or filing it as "Untitled".
 */
export function titleFromBody(body: string | undefined | null, maxLength = 80): string {
    const text = extractPlainText(body)
    if (!text || LONE_SLASH_TRIGGER.test(text)) return ''
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

export function countWords(text: string): number {
    const trimmed = text.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/u).length
}
