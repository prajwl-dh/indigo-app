import type { Note, NoteTransferFormat } from '../model/note'
import { bodyToMarkdown } from './noteMarkdown'
import { extractPlainText } from './noteText'

/**
 * Copy and export share one converter set, so a note that leaves Indigo as
 * text, Markdown, or HTML says the same thing in every format.
 */

type UnknownRecord = Record<string, unknown>

const LIST_TYPES = new Set(['bulletListItem', 'numberedListItem', 'checkListItem'])
const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'file'])

function isRecord(value: unknown): value is UnknownRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}

/* ------------------------------------------------------------------ */
/* Plain text                                                          */
/* ------------------------------------------------------------------ */

export function noteToText(note: Pick<Note, 'title' | 'body'>): string {
    const title = note.title.trim()
    const body = extractPlainText(note.body)
    return [title, body].filter((part) => part.length > 0).join('\n\n')
}

/* ------------------------------------------------------------------ */
/* Markdown                                                            */
/* ------------------------------------------------------------------ */

export function noteToMarkdown(note: Pick<Note, 'title' | 'body'>): string {
    const title = note.title.trim()
    const body = bodyToMarkdown(note.body)
    return [title ? `# ${title}` : '', body].filter((part) => part.trim().length > 0).join('\n\n')
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */

function escapeHTML(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function styles(text: string, styles: UnknownRecord | undefined): string {
    let html = escapeHTML(text)
    if (!styles) return html
    if (styles.code) html = `<code>${html}</code>`
    if (styles.bold) html = `<strong>${html}</strong>`
    if (styles.italic) html = `<em>${html}</em>`
    if (styles.strike) html = `<s>${html}</s>`
    if (styles.underline) html = `<u>${html}</u>`
    return html
}

function inlineHTML(content: unknown): string {
    if (typeof content === 'string') return escapeHTML(content)
    if (Array.isArray(content)) return content.map(inlineHTML).join('')
    if (!isRecord(content)) return ''

    if (typeof content.text === 'string') {
        return styles(content.text, content.styles as UnknownRecord | undefined)
    }

    if (content.type === 'link' && typeof content.href === 'string') {
        return `<a href="${escapeHTML(content.href)}">${inlineHTML(content.content)}</a>`
    }

    if (MEDIA_TYPES.has(String(content.type))) return ''
    return inlineHTML(content.content)
}

function listChildren(block: UnknownRecord): UnknownRecord[] {
    if (!Array.isArray(block.children)) return []
    return block.children.filter(isRecord)
}

function renderTable(content: unknown): string {
    if (!isRecord(content) || !Array.isArray(content.rows)) return ''

    const rows = content.rows
        .map((row) => {
            if (Array.isArray(row)) return row
            if (isRecord(row) && Array.isArray(row.cells)) return row.cells
            return []
        })
        .filter((cells) => cells.length > 0)

    if (rows.length === 0) return ''

    const header = rows[0].map((cell) => `<th>${inlineHTML(cell)}</th>`).join('')
    const body = rows
        .slice(1)
        .map((row) => `<tr>${row.map((cell) => `<td>${inlineHTML(cell)}</td>`).join('')}</tr>`)
        .join('')

    return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`
}

function renderBlock(block: UnknownRecord): string {
    const type = String(block.type ?? '')
    const text = inlineHTML(block.content)
    const props = isRecord(block.props) ? block.props : {}

    if (type === 'heading') {
        const level = Math.min(Math.max(Number(props.level) || 3, 3), 6)
        return text ? `<h${level}>${text}</h${level}>` : ''
    }

    if (type === 'paragraph') return text ? `<p>${text}</p>` : ''

    if (type === 'quote') {
        const children = renderBlocks(listChildren(block))
        return `<blockquote>${text ? `<p>${text}</p>` : ''}${children}</blockquote>`
    }

    if (type === 'codeBlock') {
        const source = typeof block.content === 'string' ? block.content : ''
        return source.trim() ? `<pre><code>${escapeHTML(source)}</code></pre>` : ''
    }

    if (type === 'divider') return '<hr>'

    if (type === 'image') {
        const url = typeof props.url === 'string' ? props.url : ''
        if (!url) return ''
        const caption = typeof props.caption === 'string' ? props.caption : ''
        return `<figure><img src="${escapeHTML(url)}" alt="${escapeHTML(caption)}">${
            caption ? `<figcaption>${escapeHTML(caption)}</figcaption>` : ''
        }</figure>`
    }

    if (type === 'table') return renderTable(block.content)

    if (!text) return renderBlocks(listChildren(block))
    return `<p>${text}</p>${renderBlocks(listChildren(block))}`
}

function renderBlocks(blocks: unknown): string {
    if (!Array.isArray(blocks)) return ''

    const html: string[] = []
    let index = 0

    while (index < blocks.length) {
        const block = blocks[index]
        if (!isRecord(block)) {
            index += 1
            continue
        }

        const type = String(block.type ?? '')
        if (!LIST_TYPES.has(type)) {
            html.push(renderBlock(block))
            index += 1
            continue
        }

        const ordered = type === 'numberedListItem'
        const tag = ordered ? 'ol' : 'ul'
        const items: string[] = []

        while (index < blocks.length) {
            const item = blocks[index]
            if (!isRecord(item) || !LIST_TYPES.has(String(item.type ?? ''))) break

            const itemOrdered = item.type === 'numberedListItem'
            if (itemOrdered !== ordered) break

            const props = isRecord(item.props) ? item.props : {}
            const check =
                item.type === 'checkListItem'
                    ? `<input type="checkbox" disabled${props.checked === true ? ' checked' : ''}> `
                    : ''
            const children = renderBlocks(listChildren(item))
            items.push(`<li>${check}${inlineHTML(item.content)}${children}</li>`)
            index += 1
        }

        html.push(`<${tag}>${items.join('')}</${tag}>`)
    }

    return html.join('\n')
}

/** The body alone, as HTML, for pasting into a rich-text destination. */
export function bodyToHTML(body: string | undefined | null): string {
    if (!body || body.trim() === '') return ''

    let parsed: unknown
    try {
        parsed = JSON.parse(body)
    } catch {
        return ''
    }

    return renderBlocks(parsed)
}

/** A complete, self-contained HTML document for an exported note. */
export function noteToHTML(note: Pick<Note, 'title' | 'body'>): string {
    const title = note.title.trim() || 'Untitled note'
    const body = bodyToHTML(note.body)
    const contents = body.trim() || '<p><em>(Still empty.)</em></p>'

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(title)}</title>
<style>
body { margin: 0; background: #f5f2ec; color: #1d1a16; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; }
article { max-width: 720px; margin: 0 auto; padding: 64px 24px 96px; }
h1 { font-family: Georgia, "Times New Roman", serif; font-size: 40px; line-height: 1.15; margin: 0 0 32px; }
h3, h4, h5, h6 { margin: 32px 0 12px; line-height: 1.3; }
p { margin: 0 0 16px; }
blockquote { margin: 24px 0; padding-left: 18px; border-left: 3px solid #d2c9ba; color: #413c35; }
pre { overflow-x: auto; padding: 16px; background: #ece7dd; border-radius: 6px; }
code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.92em; }
table { width: 100%; border-collapse: collapse; margin: 24px 0; }
th, td { padding: 8px 10px; border: 1px solid #d2c9ba; text-align: left; }
img { max-width: 100%; height: auto; }
hr { margin: 32px 0; border: 0; border-top: 1px solid #d2c9ba; }
</style>
</head>
<body>
<article>
<h1>${escapeHTML(title)}</h1>
${contents}
</article>
</body>
</html>
`
}

/** A rich-text fragment for the clipboard, where a full document is noise. */
export function noteToHTMLFragment(note: Pick<Note, 'title' | 'body'>): string {
    const title = note.title.trim()
    const body = bodyToHTML(note.body).trim()
    return [title ? `<h1>${escapeHTML(title)}</h1>` : '', body]
        .filter((part) => part.length > 0)
        .join('\n')
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

export function transferExtension(format: NoteTransferFormat): string {
    if (format === 'text') return '.txt'
    if (format === 'html') return '.html'
    return '.md'
}

export function transferLabel(format: NoteTransferFormat): string {
    if (format === 'text') return 'Text'
    if (format === 'html') return 'HTML'
    return 'Markdown'
}

/** The exact bytes an export writes, including the empty-note fallback. */
export function noteFileContents(note: Note, format: NoteTransferFormat): string {
    if (format === 'text') {
        const text = noteToText(note)
        return text ? `${text}\n` : '(Still empty.)\n'
    }

    if (format === 'html') return noteToHTML(note)

    const markdown = noteToMarkdown(note)
    return markdown ? `${markdown.replace(/\n{4,}/g, '\n\n\n')}\n` : '*(Still empty.)*\n'
}
