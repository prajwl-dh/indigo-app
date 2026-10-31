import { app, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Note, NoteExport } from '../../shared/model/note'
import { bodyToMarkdown } from '../../shared/util/noteMarkdown'

const FORBIDDEN = /[/\\:*?"<>|]/g

function stripControl(value: string): string {
    // Control characters have no place in a file name; keep the replacement
    // out of regexes so the lint rules can see what is being replaced.
    return Array.from(value, (char) => (char.charCodeAt(0) < 0x20 ? ' ' : char)).join('')
}

function safeFilename(note: Note): string {
    const cleaned = stripControl(note.title)
        .replace(FORBIDDEN, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)
        .replace(/[. ]+$/, '')
    return cleaned || 'Untitled note'
}

async function uniqueTarget(directory: string, base: string): Promise<string> {
    const candidate = (suffix: string): string => path.join(directory, `${base}${suffix}.md`)
    let target = candidate('')
    for (let attempt = 2; attempt <= 900; attempt += 1) {
        try {
            await fs.access(target)
            target = candidate(` (${attempt})`)
        } catch {
            return target
        }
    }
    throw new Error('Too many exported copies exist for this note title.')
}

/**
 * Exports one note as a Markdown file in the reader's downloads folder. All
 * conversion happens from the note that is on disk, so what is exported is
 * exactly what was last saved — including a note open in the editor only
 * once its pending save has settled.
 */
export function exportHandler(getNote: (id: string) => Promise<Note | null>): void {
    ipcMain.handle('notes:export', async (_event, id: unknown): Promise<NoteExport> => {
        if (typeof id !== 'string') throw new Error('A note identifier is required.')

        const note = await getNote(id)
        if (!note) throw new Error('This note no longer exists on disk.')

        const title = note.title.trim()
        const markdown = [title ? `# ${title}` : '', bodyToMarkdown(note.body)]
            .filter((section) => section.trim().length > 0)
            .join('\n\n')
        const contents = markdown
            ? `${markdown.replace(/\n{4,}/g, '\n\n\n')}\n`
            : '*(Still empty.)*\n'

        const filename = safeFilename(note)
        const directory = app.getPath('downloads')
        await fs.mkdir(directory, { recursive: true })
        const target = await uniqueTarget(directory, filename)
        await fs.writeFile(target, contents, 'utf8')

        return { path: target, filename: path.basename(target) }
    })
}
