import { app, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Note, NoteExport, NoteTransferFormat } from '../../shared/model/note'
import { noteFileContents, transferExtension } from '../../shared/util/noteTransfer'

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

function readFormat(value: unknown): NoteTransferFormat {
    if (value === 'text' || value === 'html') return value
    return 'markdown'
}

async function uniqueTarget(directory: string, base: string, extension: string): Promise<string> {
    const candidate = (suffix: string): string =>
        path.join(directory, `${base}${suffix}${extension}`)
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
 * Exports one note as text, Markdown, or HTML in the reader's downloads
 * folder. All conversion happens from the note that is on disk, so what is
 * exported is exactly what was last saved — including a note open in the
 * editor only once its pending save has settled.
 */
export function exportHandler(getNote: (id: string) => Promise<Note | null>): void {
    ipcMain.handle(
        'notes:export',
        async (_event, id: unknown, requestedFormat: unknown): Promise<NoteExport> => {
            if (typeof id !== 'string') throw new Error('A note identifier is required.')

            const note = await getNote(id)
            if (!note) throw new Error('This note no longer exists on disk.')

            const format = readFormat(requestedFormat)
            const contents = noteFileContents(note, format)
            const filename = safeFilename(note)
            const directory = app.getPath('downloads')
            await fs.mkdir(directory, { recursive: true })
            const target = await uniqueTarget(directory, filename, transferExtension(format))
            await fs.writeFile(target, contents, 'utf8')

            return { path: target, filename: path.basename(target) }
        }
    )
}
