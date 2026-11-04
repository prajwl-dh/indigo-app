import type { Note } from '../model/note'
import { extractNoteLinkIds } from './noteLinks'
import { extractTasks } from './noteTasks'
import { extractPlainText } from './noteText'

/**
 * Search is a small query language, not a second search engine. Every token is
 * either free text or one of the documented operators; anything Indigo does
 * not recognise stays free text, so searching for a URL or a time is safe.
 */

export type SearchField = 'any' | 'title' | 'body' | 'tag'

export type SearchCondition =
    | { type: 'text'; field: SearchField; value: string; negated: boolean }
    | { type: 'is'; value: string; negated: boolean }
    | { type: 'has'; value: string; negated: boolean }
    | { type: 'before'; value: string; negated: boolean }
    | { type: 'after'; value: string; negated: boolean }

export type ParsedSearch = {
    conditions: SearchCondition[]
    /** The conditions as text, useful for a compact summary. */
    source: string
}

const FIELD_NAMES: Record<string, SearchField> = {
    tag: 'tag',
    tags: 'tag',
    title: 'title',
    body: 'body'
}

const KNOWN_OPERATORS = new Set(['is', 'has', 'before', 'after'])

function tokenize(input: string): string[] {
    const tokens: string[] = []
    let current = ''
    let quote: '"' | "'" | null = null

    for (const char of input) {
        if (quote) {
            if (char === quote) {
                quote = null
            } else {
                current += char
            }
            continue
        }

        if (char === '"' || char === "'") {
            quote = char
            continue
        }

        if (/\s/u.test(char)) {
            if (current) {
                tokens.push(current)
                current = ''
            }
            continue
        }

        current += char
    }

    if (current) tokens.push(current)
    return tokens
}

function conditionFromToken(rawToken: string): SearchCondition | null {
    let token = rawToken
    let negated = false

    if (token.startsWith('-') && token.length > 1) {
        negated = true
        token = token.slice(1)
    }

    const colon = token.indexOf(':')
    if (colon > 0) {
        const key = token.slice(0, colon).toLowerCase()
        const value = token.slice(colon + 1).trim()

        if (value) {
            const field = FIELD_NAMES[key]
            if (field) return { type: 'text', field, value, negated }
            if (KNOWN_OPERATORS.has(key)) {
                return {
                    type: key as 'is' | 'has' | 'before' | 'after',
                    value,
                    negated
                }
            }
        }
    }

    if (!token) return null
    return { type: 'text', field: 'any', value: token, negated }
}

export function parseSearch(input: string): ParsedSearch {
    const source = input.trim()
    if (!source) return { conditions: [], source }

    const conditions: SearchCondition[] = []
    for (const token of tokenize(source)) {
        const condition = conditionFromToken(token)
        if (condition) conditions.push(condition)
    }

    return { conditions, source }
}

function includes(value: string, needle: string): boolean {
    return value.toLowerCase().includes(needle.toLowerCase())
}

function textMatches(note: Note, field: SearchField, value: string): boolean {
    if (field === 'title') return includes(note.title, value)
    if (field === 'tag') return note.tags.some((tag) => includes(tag, value))
    if (field === 'body') return includes(extractPlainText(note.body), value)

    return (
        includes(note.title, value) ||
        note.tags.some((tag) => includes(tag, value)) ||
        includes(extractPlainText(note.body), value)
    )
}

function isMatches(note: Note, value: string): boolean {
    switch (value.toLowerCase()) {
        case 'favorite':
        case 'favourite':
        case 'starred':
            return note.isFavorite
        case 'pinned':
            return note.isPinned === true
        case 'trash':
        case 'trashed':
            return note.isInTrash
        case 'draft':
            return note.isDraft === true
        case 'untagged':
            return note.tags.length === 0
        default:
            return false
    }
}

function hasMatches(note: Note, value: string): boolean {
    const kind = value.toLowerCase()
    if (kind === 'tag' || kind === 'tags') return note.tags.length > 0
    if (kind === 'link' || kind === 'links') return extractNoteLinkIds(note.body).length > 0
    if (kind === 'task' || kind === 'tasks' || kind === 'checkbox' || kind === 'checklist') {
        return extractTasks(note.body).length > 0
    }
    if (kind === 'text') return extractPlainText(note.body).length > 0

    const blockTypes: Record<string, string> = {
        image: 'image',
        table: 'table',
        code: 'codeBlock',
        heading: 'heading',
        quote: 'quote',
        divider: 'divider',
        file: 'file',
        video: 'video',
        audio: 'audio'
    }
    const blockType = blockTypes[kind]
    if (!blockType) return false
    return new RegExp(`"type"\\s*:\\s*"${blockType}"`).test(note.body)
}

function dateValue(value: string): number {
    if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
        const parsed = Date.parse(`${value}T00:00:00`)
        return Number.isNaN(parsed) ? NaN : parsed
    }
    return Date.parse(value)
}

function conditionMatches(note: Note, condition: SearchCondition): boolean {
    let matched: boolean

    if (condition.type === 'text') {
        matched = textMatches(note, condition.field, condition.value)
    } else if (condition.type === 'is') {
        matched = isMatches(note, condition.value)
    } else if (condition.type === 'has') {
        matched = hasMatches(note, condition.value)
    } else {
        const boundary = dateValue(condition.value)
        const modified = Date.parse(note.lastModified)
        if (Number.isNaN(boundary) || Number.isNaN(modified)) {
            matched = false
        } else if (condition.type === 'before') {
            matched = modified < boundary
        } else {
            matched = modified > boundary
        }
    }

    return condition.negated ? !matched : matched
}

/** A note matches when every condition matches; conditions are ANDed. */
export function noteMatchesSearch(note: Note, parsed: ParsedSearch): boolean {
    if (parsed.conditions.length === 0) return true
    return parsed.conditions.every((condition) => conditionMatches(note, condition))
}

/** Operators shown in the search help popover, kept next to the parser. */
export const SEARCH_OPERATOR_HELP = [
    { syntax: 'tag:travel', description: 'Notes carrying a tag' },
    { syntax: 'title:quiet', description: 'Match the title only' },
    { syntax: 'body:paper', description: 'Match the body only' },
    { syntax: 'is:favorite', description: 'Favorite, pinned, trash, draft, untagged' },
    { syntax: 'has:task', description: 'Task, link, tag, image, table, code, heading' },
    { syntax: 'before:2026-01-01', description: 'Edited before a date' },
    { syntax: 'after:2026-01-01', description: 'Edited after a date' },
    { syntax: '"exact phrase"', description: 'Keep words together' },
    { syntax: '-tag:archive', description: 'Exclude anything that matches' }
] as const
