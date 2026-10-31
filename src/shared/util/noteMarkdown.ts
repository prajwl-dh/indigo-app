import type { PartialBlock } from '@blocknote/core'

/**
 * A small, honest Markdown exporter for the notes schema Indigo writes: the
 * default BlockNote blocks (headings 3–6, lists, checklists, quotes, code and
 * dividers) plus tables, images and simple inline text. Styles inside inline
 * runs (bold, italic) are flattened to plain text; that keeps the exporter
 * predictable rather than negotiating with every inline feature.
 */

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'file'])

type UnknownRecord = Record<string, unknown>

function inlineText(content: unknown): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) return content.map(inlineText).join('')
    if (!content || typeof content !== 'object') return ''

    const value = content as UnknownRecord
    if (typeof value.text === 'string') return value.text
    if (MEDIA_TYPES.has(String(value.type))) return ''
    if (value.type === 'tableContent' && Array.isArray(value.rows)) {
        return (value.rows as unknown[])
            .map((row) => inlineText(row).replace(/\s+/g, ' ').trim())
            .join(' ')
    }
    return inlineText(value.content)
}

function isListItemType(type: string): boolean {
    return type === 'bulletListItem' || type === 'numberedListItem' || type === 'checkListItem'
}

function indent(depth: number): string {
    return '  '.repeat(depth)
}

type NumberState = { run: number; active: boolean }

function renderTable(block: PartialBlock): string {
    const content = block.content as UnknownRecord | undefined
    const rows = Array.isArray(content?.rows) ? (content?.rows as unknown[]) : []

    const readCells = (row: unknown): string[] => {
        if (Array.isArray(row)) return row.map((cell) => inlineText(cell).trim())
        if (!row || typeof row !== 'object') return []
        const record = row as UnknownRecord
        return Array.isArray(record.cells)
            ? record.cells.map((cell) => inlineText(cell).trim())
            : []
    }

    const table: string[][] = []
    let columnCount = 0
    for (const row of rows) {
        const cells = readCells(row)
        if (cells.length === 0) continue
        table.push(cells)
        columnCount = Math.max(columnCount, cells.length)
    }
    if (table.length === 0 || columnCount === 0) return ''

    const pad = (cells: string[]): string[] => {
        const next = cells.map((cell) => cell || ' ')
        while (next.length < columnCount) next.push(' ')
        return next
    }

    // The first saved row is written as the header; Markdown tables require one.
    const header = pad(table[0]).join(' | ')
    const separator = Array.from({ length: columnCount }, () => '---').join(' | ')
    const body = table.slice(1).map((row) => pad(row).join(' | '))
    return [header, separator, ...body].join('\n')
}

function renderBlock(block: PartialBlock, depth: number, numberState: NumberState): string {
    const type = typeof block.type === 'string' ? block.type : ''
    const text = inlineText(block.content).replace(/\s+/g, ' ').trim()
    const props = (block.props ?? {}) as UnknownRecord

    let rendered: string | null = null

    if (type === 'heading') {
        const level = Number(props.level) || 3
        rendered = `${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${text}`
    } else if (type === 'paragraph') {
        rendered = text
    } else if (type === 'quote') {
        rendered = `> ${text}`
    } else if (type === 'codeBlock') {
        const language = typeof props.language === 'string' ? props.language : ''
        const body = typeof block.content === 'string' ? block.content : ''
        if (body.trim()) {
            rendered = '```' + language + '\n' + body.replace(/^\n+|\n+$/g, '') + '\n```'
        }
    } else if (type === 'divider') {
        rendered = '---'
    } else if (type === 'image') {
        const url = typeof props.url === 'string' ? props.url : ''
        const caption = typeof props.caption === 'string' ? props.caption : ''
        if (url) {
            rendered = `![${caption}](${url})`
        }
    } else if (type === 'table') {
        rendered = renderTable(block)
    } else if (isListItemType(type)) {
        const numbering = type === 'numberedListItem'
        numberState.run = numbering ? (numberState.active ? numberState.run + 1 : 1) : 0
        numberState.active = numbering

        const marker =
            type === 'bulletListItem'
                ? '- '
                : numbering
                  ? `${numberState.run}. `
                  : props.checked === true
                    ? '- [x] '
                    : '- [ ] '
        rendered = `${indent(depth)}${marker}${text}`
    } else if (text) {
        // Unknown block types still give up their text.
        rendered = text
    }

    const parts = rendered === null ? [] : [rendered]

    if (Array.isArray(block.children)) {
        for (const child of block.children) {
            const childLines = renderBlock(child, depth + 1, numberState)
            if (childLines) parts.push(childLines)
        }
    }

    return parts.join('\n')
}

/**
 * Converts a saved note body into Markdown. Returns an empty string for
 * documents that carry nothing readable.
 */
export function bodyToMarkdown(body: string | undefined | null): string {
    if (!body || body.trim() === '') return ''

    let blocks: PartialBlock[]
    try {
        const parsed = JSON.parse(body) as unknown
        if (!Array.isArray(parsed)) return ''
        blocks = parsed as PartialBlock[]
    } catch {
        return ''
    }

    const numberState: NumberState = { run: 0, active: false }
    const sections: string[] = []
    for (const block of blocks) {
        // Numbering restarts only when a non-list block separates the runs.
        if (!isListItemType(String(block.type))) {
            numberState.run = 0
            numberState.active = false
        }

        const markdown = renderBlock(block, 0, numberState)
        if (markdown) sections.push(markdown)
    }

    if (sections.length === 0) return ''
    return `${sections.join('\n\n')}\n`
}
