import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { access, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
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

describe('NotesStore tags file safety', () => {
    it('preserves a corrupt tags file and rebuilds the list from notes', async () => {
        const note = await store.createNote({ tags: ['alpha'] })
        expect(note.tags).toEqual(['alpha'])

        const corrupt = '{"tags": [ this is not json\n'
        await writeFile(join(directory, '_tags.json'), corrupt)

        const tags = await store.listTags()
        expect(tags.map((tag) => tag.name)).toEqual(['alpha'])

        const entries = await readdir(directory)
        const backup = entries.find((name) => name.startsWith('_tags.corrupt-'))
        expect(backup).toBeTruthy()
        expect(await readFile(join(directory, backup as string), 'utf8')).toBe(corrupt)

        const rebuilt = JSON.parse(await readFile(join(directory, '_tags.json'), 'utf8'))
        expect(rebuilt).toEqual([expect.objectContaining({ name: 'alpha' })])
    })

    it('preserves a non-array tags file and rebuilds it from notes', async () => {
        await store.createNote({ tags: ['beta'] })
        await writeFile(join(directory, '_tags.json'), '{"beta": true}\n')

        const tags = await store.listTags()

        expect(tags.map((tag) => tag.name)).toEqual(['beta'])
        const entries = await readdir(directory)
        expect(entries.some((name) => name.startsWith('_tags.corrupt-'))).toBe(true)
    })

    it('keeps tags named by notes when the tags file is missing', async () => {
        await store.createNote({ tags: ['alpha'] })
        await rm(join(directory, '_tags.json'), { force: true })

        await store.createTag('beta')

        const tags = await store.listTags()
        expect(tags.map((tag) => tag.name).sort()).toEqual(['alpha', 'beta'])
    })

    it('refuses to overwrite a tags path it cannot read', async () => {
        await rm(join(directory, '_tags.json'), { force: true })
        await mkdir(join(directory, '_tags.json'))

        await expect(store.createTag('gamma')).rejects.toThrow(/could not read the tags file/i)
        expect((await stat(join(directory, '_tags.json'))).isDirectory()).toBe(true)
    })

    it('reports a rebuilt tags file in storage health', async () => {
        await store.createNote({ tags: ['alpha'] })
        await writeFile(join(directory, '_tags.json'), 'not json\n')

        await store.listTags()
        const info = await store.getStorageInfo()

        expect(info.tagsFile).toBe('repaired')
        expect(info.tagsBackup).toMatch(/^_tags\.corrupt-/)
    })

    it('reports an unreadable tags path without throwing', async () => {
        await rm(join(directory, '_tags.json'), { force: true })
        await mkdir(join(directory, '_tags.json'))

        const info = await store.getStorageInfo()

        expect(info.tagsFile).toBe('unreadable')
        expect(info.skippedFiles).toEqual([])
    })
})

describe('NotesStore storage health', () => {
    it('reports files it skipped without deleting them', async () => {
        await writeNote('good-note', { title: 'Readable' })
        await writeFile(join(directory, 'backup.json'), '{"hello":"world"}\n')
        await writeFile(join(directory, 'broken.json'), '{"title":\n')

        const info = await store.getStorageInfo()

        expect(info.noteCount).toBe(1)
        expect(info.skippedFiles).toEqual(
            expect.arrayContaining([
                { file: 'backup.json', reason: 'not-a-note' },
                { file: 'broken.json', reason: 'unreadable' }
            ])
        )
        expect(await exists('backup.json')).toBe(true)
        expect(await exists('broken.json')).toBe(true)
    })
})

describe('NotesStore hard reset', () => {
    it('removes recognized notes and tags but leaves unknown files and backups', async () => {
        const note = await store.createNote({ tags: ['alpha'] })
        await store.updateNote({ id: note.id, title: 'Real note', body: TEXT_BODY })
        await writeFile(join(directory, 'backup.json'), '{"hello":"world"}\n')
        await writeFile(join(directory, 'broken.json'), '{"title":\n')
        await writeFile(join(directory, '_tags.corrupt-old.json'), '[]\n')

        await store.reset()

        expect(await exists(`${note.id}.json`)).toBe(false)
        expect(await exists('backup.json')).toBe(true)
        expect(await exists('broken.json')).toBe(true)
        expect(await exists('_tags.corrupt-old.json')).toBe(true)
        expect(JSON.parse(await readFile(join(directory, '_tags.json'), 'utf8'))).toEqual([])
    })
})

describe('NotesStore atomic writes', () => {
    it('leaves no temporary file behind after a save', async () => {
        const note = await store.createNote()
        await store.updateNote({ id: note.id, title: 'Saved', body: TEXT_BODY })

        const entries = await readdir(directory)
        expect(entries.some((name) => name.endsWith('.tmp'))).toBe(false)
        expect(await readStoredNote(note.id)).toMatchObject({ title: 'Saved' })
    })
})
