import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NotesStore } from '../../src/main/storage/notesStore'

const TABLE_BODY = JSON.stringify([
    {
        type: 'table',
        content: {
            type: 'tableContent',
            rows: [{ cells: [{ type: 'text', text: 'Cell text', styles: {} }] }]
        }
    }
])

const IMAGE_BODY = JSON.stringify([
    {
        type: 'image',
        props: {
            url: 'https://example.com/image.png',
            name: 'A photograph',
            caption: '',
            previewWidth: 320
        },
        children: []
    }
])

const TEXT_BODY = JSON.stringify([
    {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Typed at the last moment', styles: {} }],
        children: []
    }
])

const CODE_BODY = JSON.stringify([
    {
        type: 'codeBlock',
        props: { language: 'ts' },
        content: 'const answer = 42',
        children: []
    }
])

let directory: string
let store: NotesStore

beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'indigo-notes-'))
    store = new NotesStore(directory)
})

afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
})

async function exists(name: string): Promise<boolean> {
    try {
        await access(join(directory, name))
        return true
    } catch {
        return false
    }
}

async function writeNote(id: string, overrides: Record<string, unknown> = {}): Promise<void> {
    const timestamp = '2026-01-01T00:00:00.000Z'
    await writeFile(
        join(directory, `${id}.json`),
        `${JSON.stringify(
            {
                id,
                title: '',
                body: '',
                createdAt: timestamp,
                lastModified: timestamp,
                isFavorite: false,
                isInTrash: false,
                tags: [],
                color: null,
                ...overrides
            },
            null,
            2
        )}\n`
    )
}

async function readStoredNote(id: string): Promise<Record<string, unknown>> {
    return JSON.parse(await readFile(join(directory, `${id}.json`), 'utf8')) as Record<
        string,
        unknown
    >
}

describe('NotesStore.pruneDrafts', () => {
    it('preserves an unknown JSON object instead of turning it into a blank note', async () => {
        await writeFile(join(directory, 'backup.json'), '{"hello":"world"}\n')

        await store.init()

        expect(await exists('backup.json')).toBe(true)
        expect(await store.listNotes()).toEqual([])
    })

    it('preserves a JSON array', async () => {
        await writeFile(join(directory, 'array.json'), '[]\n')

        await store.init()

        expect(await exists('array.json')).toBe(true)
        expect(await store.listNotes()).toEqual([])
    })

    it('preserves malformed JSON', async () => {
        await writeFile(join(directory, 'broken.json'), '{"title":\n')

        await store.init()

        expect(await exists('broken.json')).toBe(true)
        expect(await store.listNotes()).toEqual([])
    })

    it('preserves an empty note that was not created by this version', async () => {
        await writeNote('old-empty')

        await store.init()

        expect(await exists('old-empty.json')).toBe(true)
        expect(await store.listNotes()).toHaveLength(1)
    })

    it('preserves a renamed empty draft so a backup is never pruned', async () => {
        await writeNote('renamed-draft', { id: 'original-id', isDraft: true })

        await store.init()

        expect(await exists('renamed-draft.json')).toBe(true)
        expect(await store.listNotes()).toHaveLength(1)
    })

    it('removes a draft created by the app when it is still empty', async () => {
        const note = await store.createNote()
        expect(note.isDraft).toBe(true)

        await store.init()

        expect(await exists(`${note.id}.json`)).toBe(false)
    })

    it('preserves a table-only note and derives a title from its cells', async () => {
        await writeNote('table-note', { body: TABLE_BODY })

        await store.init()

        expect(await exists('table-note.json')).toBe(true)
        expect(await readStoredNote('table-note')).toMatchObject({ title: 'Cell text' })
    })

    it('preserves a table-only draft instead of treating it as empty', async () => {
        await writeNote('table-draft', { body: TABLE_BODY, isDraft: true })

        await store.init()

        expect(await exists('table-draft.json')).toBe(true)
        expect(await readStoredNote('table-draft')).toMatchObject({ title: 'Cell text' })
    })

    it('preserves an image-only note', async () => {
        await writeNote('image-note', { body: IMAGE_BODY })

        await store.init()

        expect(await exists('image-note.json')).toBe(true)
    })

    it('preserves an image-only draft instead of treating it as empty', async () => {
        await writeNote('image-draft', { body: IMAGE_BODY, isDraft: true })

        await store.init()

        expect(await exists('image-draft.json')).toBe(true)
    })

    it('preserves a code-only draft and derives a title from its code', async () => {
        await writeNote('code-draft', { body: CODE_BODY, isDraft: true })

        await store.init()

        expect(await exists('code-draft.json')).toBe(true)
        expect(await readStoredNote('code-draft')).toMatchObject({
            title: 'const answer = 42'
        })
    })

    it('gives a body-only note a title instead of deleting it', async () => {
        await writeNote('body-only', { body: TEXT_BODY })

        await store.init()

        expect(await exists('body-only.json')).toBe(true)
        expect(await readStoredNote('body-only')).toMatchObject({
            title: 'Typed at the last moment'
        })
    })
})

describe('NotesStore identity', () => {
    it('uses the filename as the note identity so a restored file stays editable', async () => {
        await writeNote('filename-id', { id: 'different-id', title: 'Restored note' })

        await store.init()

        const notes = await store.listNotes()
        expect(notes).toHaveLength(1)
        expect(notes[0].id).toBe('filename-id')

        const updated = await store.updateNote({ id: 'filename-id', title: 'Edited' })
        expect(updated.id).toBe('filename-id')
        expect(await readStoredNote('filename-id')).toMatchObject({
            id: 'filename-id',
            title: 'Edited'
        })
        expect(await exists('different-id.json')).toBe(false)
    })
})
