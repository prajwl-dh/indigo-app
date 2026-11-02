import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NotesStore } from '../../src/main/storage/notesStore'

let directory: string
let store: NotesStore

const PARAGRAPH_BODY = JSON.stringify([
    {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Written content', styles: {} }],
        children: []
    }
])

beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'indigo-notes-'))
    store = new NotesStore(directory)
    await store.init()
})

afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
})

describe('pinned notes', () => {
    it('persists a pin without touching the "Edited" timestamp', async () => {
        const note = await store.createNote()
        await store.updateNote({ id: note.id, title: 'Pinned', body: PARAGRAPH_BODY })

        const before = await store.getNote(note.id)
        expect(before?.isPinned).toBe(false)

        const pinned = await store.updateNote({ id: note.id, isPinned: true })
        expect(pinned.isPinned).toBe(true)
        expect(pinned.lastModified).toBe(before?.lastModified)
        expect(pinned.title).toBe('Pinned')

        const reread = await store.getNote(note.id)
        expect(reread?.isPinned).toBe(true)
    })

    it('accepts old note files without a pin and keeps them unpinned', async () => {
        const timestamp = '2025-01-01T00:00:00.000Z'
        await writeFile(
            join(directory, 'legacy.json'),
            `${JSON.stringify({
                id: 'legacy',
                title: 'From before pinning',
                body: '',
                createdAt: timestamp,
                lastModified: timestamp,
                isFavorite: false,
                isInTrash: false,
                tags: []
            })}\n`
        )

        const note = await store.getNote('legacy')
        expect(note?.isPinned).toBe(false)
    })

    it('leaves the duplicate of a pinned note unpinned', async () => {
        const note = await store.createNote()
        await store.updateNote({ id: note.id, title: 'Original', body: PARAGRAPH_BODY })
        await store.updateNote({ id: note.id, isPinned: true })

        const duplicate = await store.duplicateNote(note.id)
        expect(duplicate.isPinned).toBe(false)
        expect(duplicate.title).toBe('Original copy')
    })
})
