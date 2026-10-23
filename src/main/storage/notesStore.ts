import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Note, NotePatch, Notes, StorageInfo, Tag, Tags } from '../../shared/model/note'
import { isNoteColor } from '../../shared/model/noteColor'
import { titleFromBody } from '../../shared/util/noteText'
import { findTag, MAX_TAGS_PER_NOTE, normalizeTagName } from '../../shared/util/tags'

const TAGS_FILE = '_tags.json'
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/

function now(): string {
    return new Date().toISOString()
}

function uniqueTags(values: unknown): string[] {
    if (!Array.isArray(values)) return []

    const tags: string[] = []
    for (const value of values) {
        if (typeof value !== 'string') continue
        const name = normalizeTagName(value)
        if (!name) continue
        if (tags.some((tag) => findTag([tag], name))) continue
        tags.push(name)
        if (tags.length >= MAX_TAGS_PER_NOTE) break
    }
    return tags
}

function parseNote(raw: unknown, fallbackId: string): Note | null {
    if (!raw || typeof raw !== 'object') return null
    const value = raw as Record<string, unknown>

    const id = typeof value.id === 'string' && SAFE_ID.test(value.id) ? value.id : fallbackId
    if (!SAFE_ID.test(id)) return null

    const modified =
        typeof value.lastModified === 'string' && !Number.isNaN(Date.parse(value.lastModified))
            ? value.lastModified
            : now()

    return {
        id,
        title: typeof value.title === 'string' ? value.title : '',
        body: typeof value.body === 'string' ? value.body : '',
        lastModified: modified,
        createdAt:
            typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt))
                ? value.createdAt
                : modified,
        isFavorite: value.isFavorite === true,
        isInTrash: value.isInTrash === true,
        tags: uniqueTags(value.tags),
        color: isNoteColor(value.color) ? value.color : null
    }
}

export class NotesStore {
    private readonly directory: string
    private readonly tagsPath: string
    private queue: Promise<unknown> = Promise.resolve()

    constructor(directory: string) {
        this.directory = directory
        this.tagsPath = path.join(directory, TAGS_FILE)
    }

    get directoryPath(): string {
        return this.directory
    }

    async init(): Promise<void> {
        await fs.mkdir(this.directory, { recursive: true })
        try {
            await fs.access(this.tagsPath)
        } catch {
            await this.writeTags([])
        }
        await this.pruneDrafts()
    }

    /**
     * A note only exists once it has a title. Empty drafts are discarded, and a
     * body written without a title is filed under its opening words. Run at
     * startup and again before quitting, so a blank draft left open when the
     * app closes never survives on disk.
     */
    async pruneDrafts(): Promise<void> {
        return this.enqueue(async () => {
            const notes = await this.listNotesUnsafe()

            for (const note of notes) {
                if (note.title.trim()) continue

                const title = titleFromBody(note.body)
                if (!title) {
                    await fs.rm(this.notePath(note.id), { force: true })
                    continue
                }

                note.title = title
                await this.writeNote(note)
            }
        })
    }

    private enqueue<Result>(task: () => Promise<Result>): Promise<Result> {
        const result = this.queue.then(task, task)
        this.queue = result.then(
            () => undefined,
            () => undefined
        )
        return result
    }

    private notePath(id: string): string {
        if (!SAFE_ID.test(id)) {
            throw new Error('That note identifier is not valid.')
        }
        return path.join(this.directory, `${id}.json`)
    }

    private async writeAtomic(filePath: string, contents: string): Promise<void> {
        const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        try {
            await fs.writeFile(temporary, contents, { encoding: 'utf8', mode: 0o600 })
            await fs.rename(temporary, filePath)
        } catch (error) {
            await fs.rm(temporary, { force: true }).catch(() => undefined)
            throw error
        }
    }

    private async writeNote(note: Note): Promise<void> {
        await this.writeAtomic(this.notePath(note.id), `${JSON.stringify(note, null, 2)}\n`)
    }

    private async readTagsUnsafe(): Promise<Tags> {
        try {
            const contents = await fs.readFile(this.tagsPath, 'utf8')
            const parsed = JSON.parse(contents) as unknown
            if (!Array.isArray(parsed)) return []

            const tags: Tags = []
            for (const entry of parsed) {
                const rawName =
                    typeof entry === 'string'
                        ? entry
                        : entry && typeof entry === 'object'
                          ? (entry as Record<string, unknown>).name
                          : null
                if (typeof rawName !== 'string') continue
                const name = normalizeTagName(rawName)
                if (
                    !name ||
                    findTag(
                        tags.map((tag) => tag.name),
                        name
                    )
                )
                    continue
                const createdAt =
                    entry && typeof entry === 'object'
                        ? (entry as Record<string, unknown>).createdAt
                        : null
                tags.push({
                    name,
                    createdAt:
                        typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt))
                            ? createdAt
                            : now()
                })
            }
            return tags
        } catch {
            return []
        }
    }

    private async writeTags(tags: Tags): Promise<void> {
        await this.writeAtomic(this.tagsPath, `${JSON.stringify(tags, null, 2)}\n`)
    }

    private async readNoteUnsafe(id: string): Promise<Note | null> {
        try {
            const contents = await fs.readFile(this.notePath(id), 'utf8')
            return parseNote(JSON.parse(contents) as unknown, id)
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code
            if (code === 'ENOENT') return null
            console.warn(`[notes] Could not read note ${id}`, error)
            return null
        }
    }

    listNotes(): Promise<Notes> {
        return this.enqueue(async () => {
            const entries = await fs.readdir(this.directory, { withFileTypes: true })
            const notes: Notes = []

            for (const entry of entries) {
                if (!entry.isFile()) continue
                if (entry.name === TAGS_FILE) continue
                if (!entry.name.endsWith('.json')) continue

                const id = entry.name.slice(0, -'.json'.length)
                if (!SAFE_ID.test(id)) continue

                try {
                    const contents = await fs.readFile(
                        path.join(this.directory, entry.name),
                        'utf8'
                    )
                    const note = parseNote(JSON.parse(contents) as unknown, id)
                    if (note) notes.push(note)
                } catch (error) {
                    console.warn(`[notes] Skipped unreadable note ${entry.name}`, error)
                }
            }

            return notes
        })
    }

    getNote(id: string): Promise<Note | null> {
        return this.enqueue(() => this.readNoteUnsafe(id))
    }

    createNote(input?: {
        isFavorite?: boolean
        tags?: string[]
        color?: Note['color']
    }): Promise<Note> {
        return this.enqueue(async () => {
            const timestamp = now()
            const note: Note = {
                id: randomUUID(),
                title: '',
                body: '',
                createdAt: timestamp,
                lastModified: timestamp,
                isFavorite: input?.isFavorite === true,
                isInTrash: false,
                tags: uniqueTags(input?.tags),
                color: isNoteColor(input?.color) ? input.color : null
            }

            if (note.tags.length > 0) {
                await this.ensureTagsUnsafe(note.tags)
            }

            await this.writeNote(note)
            return note
        })
    }

    updateNote(patch: NotePatch): Promise<Note> {
        return this.enqueue(async () => {
            const current = await this.readNoteUnsafe(patch.id)
            if (!current) {
                throw new Error('This note no longer exists on disk.')
            }

            // A colour is an identifier, not an edit: colouring a note should
            // not reshuffle the library under the reader's cursor.
            const onlyColor =
                patch.color !== undefined &&
                patch.title === undefined &&
                patch.body === undefined &&
                patch.tags === undefined &&
                patch.isFavorite === undefined &&
                patch.isInTrash === undefined

            const next: Note = {
                ...current,
                lastModified: onlyColor ? current.lastModified : now()
            }

            if (typeof patch.title === 'string') next.title = patch.title
            if (typeof patch.body === 'string') next.body = patch.body
            if (typeof patch.isFavorite === 'boolean') next.isFavorite = patch.isFavorite
            if (typeof patch.isInTrash === 'boolean') next.isInTrash = patch.isInTrash
            if (patch.tags !== undefined) next.tags = uniqueTags(patch.tags)
            if (patch.color === null || isNoteColor(patch.color)) next.color = patch.color

            if (next.tags.length > 0) {
                await this.ensureTagsUnsafe(next.tags)
            }

            await this.writeNote(next)
            return next
        })
    }

    duplicateNote(id: string): Promise<Note> {
        return this.enqueue(async () => {
            const current = await this.readNoteUnsafe(id)
            if (!current) {
                throw new Error('This note no longer exists on disk.')
            }

            const timestamp = now()
            const title = current.title.trim() ? `${current.title.trim()} copy` : 'Untitled note'
            const duplicate: Note = {
                ...current,
                id: randomUUID(),
                title,
                createdAt: timestamp,
                lastModified: timestamp,
                isInTrash: false
            }

            await this.writeNote(duplicate)
            return duplicate
        })
    }

    deleteNote(id: string): Promise<boolean> {
        return this.enqueue(async () => {
            await fs.rm(this.notePath(id), { force: true })
            return true
        })
    }

    emptyTrash(): Promise<number> {
        return this.enqueue(async () => {
            const entries = await fs.readdir(this.directory, { withFileTypes: true })
            let removed = 0

            for (const entry of entries) {
                if (!entry.isFile() || !entry.name.endsWith('.json')) continue
                if (entry.name === TAGS_FILE) continue

                const id = entry.name.slice(0, -'.json'.length)
                const note = await this.readNoteUnsafe(id)
                if (!note?.isInTrash) continue

                await fs.rm(path.join(this.directory, entry.name), { force: true })
                removed += 1
            }

            return removed
        })
    }

    listTags(): Promise<Tags> {
        return this.enqueue(async () => {
            const tags = await this.readTagsUnsafe()
            if (tags.length === 0) {
                const notes = await this.listNotesUnsafe()
                const names = new Set<string>()
                for (const note of notes) {
                    for (const name of note.tags) names.add(name)
                }
                if (names.size > 0) {
                    const timestamp = now()
                    const discovered = [...names]
                        .sort((a, b) => a.localeCompare(b))
                        .map((name) => ({ name, createdAt: timestamp }))
                    await this.writeTags(discovered)
                    return discovered
                }
            }
            return tags
        })
    }

    createTag(input: string): Promise<Tag> {
        return this.enqueue(async () => {
            const name = normalizeTagName(input)
            if (!name) throw new Error('Give the tag a name first.')

            const tags = await this.readTagsUnsafe()
            const existing = tags.find((tag) => findTag([tag.name], name))
            if (existing) return existing

            const tag: Tag = { name, createdAt: now() }
            tags.push(tag)
            await this.writeTags(tags)
            return tag
        })
    }

    renameTag(oldName: string, nextName: string): Promise<Tag> {
        return this.enqueue(async () => {
            const name = normalizeTagName(nextName)
            if (!name) throw new Error('Give the tag a name first.')

            const tags = await this.readTagsUnsafe()
            const current = tags.find((tag) => findTag([tag.name], oldName))
            if (!current) {
                return this.createTagUnsafe(name)
            }

            if (current.name === name) return current

            const conflict = tags.find((tag) => tag !== current && findTag([tag.name], name))
            if (conflict) throw new Error('A tag with that name already exists.')

            current.name = name
            await this.writeTags(tags)

            const notes = await this.listNotesUnsafe()
            for (const note of notes) {
                if (!note.tags.some((tag) => findTag([tag], oldName))) continue
                note.tags = note.tags.map((tag) => (findTag([tag], oldName) ? name : tag))
                note.lastModified = now()
                await this.writeNote(note)
            }

            return current
        })
    }

    deleteTag(name: string): Promise<boolean> {
        return this.enqueue(async () => {
            const tags = await this.readTagsUnsafe()
            const remaining = tags.filter((tag) => !findTag([tag.name], name))
            await this.writeTags(remaining)

            const notes = await this.listNotesUnsafe()
            for (const note of notes) {
                if (!note.tags.some((tag) => findTag([tag], name))) continue
                note.tags = note.tags.filter((tag) => !findTag([tag], name))
                note.lastModified = now()
                await this.writeNote(note)
            }

            return true
        })
    }

    reset(): Promise<void> {
        return this.enqueue(async () => {
            const entries = await fs.readdir(this.directory, { withFileTypes: true })

            for (const entry of entries) {
                if (!entry.isFile()) continue
                await fs.rm(path.join(this.directory, entry.name), { force: true })
            }

            await this.writeTags([])
        })
    }

    getStorageInfo(): Promise<StorageInfo> {
        return this.enqueue(async () => {
            const notes = await this.listNotesUnsafe()
            return { notesDirectory: this.directory, noteCount: notes.length }
        })
    }

    private async listNotesUnsafe(): Promise<Notes> {
        const entries = await fs.readdir(this.directory, { withFileTypes: true })
        const notes: Notes = []

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue
            if (entry.name === TAGS_FILE) continue
            const id = entry.name.slice(0, -'.json'.length)
            if (!SAFE_ID.test(id)) continue
            const note = await this.readNoteUnsafe(id)
            if (note) notes.push(note)
        }

        return notes
    }

    private async ensureTagsUnsafe(names: string[]): Promise<void> {
        const tags = await this.readTagsUnsafe()
        let changed = false

        for (const name of names) {
            const normalized = normalizeTagName(name)
            if (!normalized) continue
            if (tags.some((tag) => findTag([tag.name], normalized))) continue
            tags.push({ name: normalized, createdAt: now() })
            changed = true
        }

        if (changed) await this.writeTags(tags)
    }

    private async createTagUnsafe(name: string): Promise<Tag> {
        const tags = await this.readTagsUnsafe()
        const existing = tags.find((tag) => findTag([tag.name], name))
        if (existing) return existing
        const tag: Tag = { name, createdAt: now() }
        tags.push(tag)
        await this.writeTags(tags)
        return tag
    }
}
