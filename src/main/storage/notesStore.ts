import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
    Note,
    NotePatch,
    Notes,
    StorageFileIssue,
    StorageInfo,
    Tag,
    Tags,
    TagsFileState
} from '../../shared/model/note'
import { isNoteColor } from '../../shared/model/noteColor'
import { isBlockDocumentEmpty, titleFromBody } from '../../shared/util/noteText'
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isProvablyEmptyDraft(note: Note): boolean {
    if (note.isDraft !== true) return false
    if (note.title.trim().length > 0) return false
    if (!isBlockDocumentEmpty(note.body)) return false
    if (note.body.trim() === '') return true

    try {
        // A BlockNote document is an array. Anything else that happens to be
        // empty-looking (for example "{}" or "null") is not provably ours.
        return Array.isArray(JSON.parse(note.body))
    } catch {
        return false
    }
}

function parseNote(raw: unknown, fallbackId: string): Note | null {
    if (!isRecord(raw)) return null
    if (!SAFE_ID.test(fallbackId)) return null

    // A note must at least look like a note. Files that merely happen to be
    // JSON objects (backups, exports, arrays, other tools' data) are left
    // alone rather than being turned into blank notes and pruned.
    const hasTitle = typeof raw.title === 'string'
    const hasBody = typeof raw.body === 'string'
    if (!hasTitle && !hasBody) return null

    // The filename is the identity. Older or restored files may disagree with
    // their internal id; trusting the filename keeps reads, saves and deletes
    // pointed at the same file.
    const id = fallbackId

    const modified =
        typeof raw.lastModified === 'string' && !Number.isNaN(Date.parse(raw.lastModified))
            ? raw.lastModified
            : now()

    return {
        id,
        title: typeof raw.title === 'string' ? raw.title : '',
        body: typeof raw.body === 'string' ? raw.body : '',
        lastModified: modified,
        createdAt:
            typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt))
                ? raw.createdAt
                : modified,
        isFavorite: raw.isFavorite === true,
        isInTrash: raw.isInTrash === true,
        tags: uniqueTags(raw.tags),
        color: isNoteColor(raw.color) ? raw.color : null,
        // Only trust the draft marker when the file still carries the id it
        // was created with. A renamed copy is a backup, not a prunable draft.
        isDraft: raw.isDraft === true && raw.id === id
    }
}

type TagsFileRead = {
    tags: Tags
    state: 'ok' | 'missing' | 'corrupt'
    raw: string | null
}

type NoteScan = {
    notes: Notes
    issues: StorageFileIssue[]
}

export class NotesStore {
    private readonly directory: string
    private readonly tagsPath: string
    private queue: Promise<unknown> = Promise.resolve()
    // Set when a corrupt tags file has been preserved and rebuilt during this
    // session, so Settings can tell the reader where the old file went.
    private tagsBackupName: string | null = null

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
     * Remove only drafts this app created and that are provably still empty.
     * A body written without a title is filed under its opening words. Files
     * that do not parse as notes, or that lack the draft marker, are preserved.
     * Run at startup and again before quitting.
     */
    async pruneDrafts(): Promise<void> {
        return this.enqueue(async () => {
            const notes = await this.listNotesUnsafe()

            for (const note of notes) {
                if (note.title.trim()) continue

                if (isProvablyEmptyDraft(note)) {
                    await fs.rm(this.notePath(note.id), { force: true })
                    continue
                }

                if (isBlockDocumentEmpty(note.body)) continue

                const title = titleFromBody(note.body)
                if (!title) continue

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
        const directory = path.dirname(filePath)
        await fs.mkdir(directory, { recursive: true })

        let handle: Awaited<ReturnType<typeof fs.open>> | null = null
        try {
            handle = await fs.open(temporary, 'w', 0o600)
            await handle.writeFile(contents, 'utf8')
            // Flush the bytes before the rename. Without this a power loss can
            // leave the rename durable but the file contents empty.
            await handle.sync()
            await handle.close()
            handle = null

            await fs.rename(temporary, filePath)
            await this.syncDirectory(directory)
        } catch (error) {
            if (handle) await handle.close().catch(() => undefined)
            await fs.rm(temporary, { force: true }).catch(() => undefined)
            throw error
        }
    }

    private async syncDirectory(directory: string): Promise<void> {
        // The rename itself is made durable by syncing the directory. Some
        // platforms (and some network filesystems) do not support this; the
        // file write has already been flushed, so it is safe to continue.
        let handle: Awaited<ReturnType<typeof fs.open>> | null = null
        try {
            handle = await fs.open(directory, 'r')
            await handle.sync()
        } catch {
            // Not every platform allows a directory to be opened or synced.
        } finally {
            await handle?.close().catch(() => undefined)
        }
    }

    private async writeNote(note: Note): Promise<void> {
        await this.writeAtomic(this.notePath(note.id), `${JSON.stringify(note, null, 2)}\n`)
    }

    private async readTagsFileUnsafe(): Promise<TagsFileRead> {
        let contents: string
        try {
            contents = await fs.readFile(this.tagsPath, 'utf8')
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return { tags: [], state: 'missing', raw: null }
            }

            // An unreadable file is not an empty one. Failing here keeps every
            // tag operation from overwriting a file Indigo could not inspect.
            throw new Error(
                'Indigo could not read the tags file, so your tags were left untouched.'
            )
        }

        try {
            const parsed = JSON.parse(contents) as unknown
            if (!Array.isArray(parsed)) {
                return { tags: [], state: 'corrupt', raw: contents }
            }

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

            // A non-empty array with no usable tag is a malformed file, not an
            // empty tag list. Preserve it rather than treating it as "no tags".
            if (tags.length === 0 && parsed.length > 0) {
                return { tags: [], state: 'corrupt', raw: contents }
            }

            return { tags, state: 'ok', raw: contents }
        } catch {
            return { tags: [], state: 'corrupt', raw: contents }
        }
    }

    private async readTagsUnsafe(): Promise<Tags> {
        const result = await this.readTagsFileUnsafe()
        if (result.state === 'ok') return result.tags
        if (result.state === 'missing') {
            // No tags file is not the same as no tags. Notes may still name
            // tags, and the next write must not drop them.
            return this.tagsFromNotesUnsafe()
        }

        return this.repairTagsUnsafe(result.raw ?? '')
    }

    /**
     * A corrupt tags file is evidence, not garbage. Keep the exact bytes in a
     * sibling backup, then rebuild the list from the tags still named by notes.
     * If the backup cannot be written, the rebuild does not happen either.
     */
    private async repairTagsUnsafe(raw: string): Promise<Tags> {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        const backupName = `_tags.corrupt-${stamp}-${randomUUID().slice(0, 8)}.json`
        await this.writeAtomic(path.join(this.directory, backupName), raw)
        this.tagsBackupName = backupName

        const rebuilt = await this.tagsFromNotesUnsafe()
        await this.writeTags(rebuilt)
        console.warn(`[tags] preserved unreadable tags in ${backupName} and rebuilt the list`)
        return rebuilt
    }

    private async tagsFromNotesUnsafe(): Promise<Tags> {
        const notes = await this.listNotesUnsafe()
        const names = new Set<string>()
        for (const note of notes) {
            for (const name of note.tags) names.add(name)
        }

        const timestamp = now()
        return [...names]
            .sort((a, b) => a.localeCompare(b))
            .map((name) => ({ name, createdAt: timestamp }))
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
        return this.enqueue(async () => (await this.scanNotesUnsafe()).notes)
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
                color: isNoteColor(input?.color) ? input.color : null,
                isDraft: true
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

            // Once a draft has real content it is a note. Emptying an existing
            // note later does not turn it back into a prunable draft.
            if (next.title.trim().length > 0 || !isBlockDocumentEmpty(next.body)) {
                next.isDraft = false
            }

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
                isInTrash: false,
                isDraft: false
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
            if (tags.length > 0) return tags

            const discovered = await this.tagsFromNotesUnsafe()
            if (discovered.length > 0) await this.writeTags(discovered)
            return discovered
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

    /**
     * Hard reset removes only files Indigo recognizes as notes, plus the tags
     * file. Unknown JSON, backups, and malformed files are left where they are.
     */
    reset(): Promise<void> {
        return this.enqueue(async () => {
            const { notes } = await this.scanNotesUnsafe()

            for (const note of notes) {
                await fs.rm(this.notePath(note.id), { force: true })
            }

            await this.writeTags([])
            this.tagsBackupName = null
        })
    }

    getStorageInfo(): Promise<StorageInfo> {
        return this.enqueue(async () => {
            const { notes, issues } = await this.scanNotesUnsafe()

            let tagsFile: TagsFileState = 'ok'
            if (this.tagsBackupName) {
                tagsFile = 'repaired'
            } else {
                try {
                    tagsFile = (await this.readTagsFileUnsafe()).state
                } catch {
                    tagsFile = 'unreadable'
                }
            }

            return {
                notesDirectory: this.directory,
                noteCount: notes.length,
                skippedFiles: issues,
                tagsFile,
                tagsBackup: this.tagsBackupName
            }
        })
    }

    private async scanNotesUnsafe(): Promise<NoteScan> {
        const entries = await fs.readdir(this.directory, { withFileTypes: true })
        const notes: Notes = []
        const issues: StorageFileIssue[] = []

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue
            // The tags file and the backups written when it is repaired are
            // Indigo metadata, not notes.
            if (entry.name === TAGS_FILE || entry.name.startsWith('_tags.')) continue

            const id = entry.name.slice(0, -'.json'.length)
            if (!SAFE_ID.test(id)) {
                issues.push({ file: entry.name, reason: 'not-a-note' })
                continue
            }

            try {
                const contents = await fs.readFile(path.join(this.directory, entry.name), 'utf8')
                const note = parseNote(JSON.parse(contents) as unknown, id)
                if (note) notes.push(note)
                else issues.push({ file: entry.name, reason: 'not-a-note' })
            } catch (error) {
                console.warn(`[notes] Skipped unreadable note ${entry.name}`, error)
                issues.push({ file: entry.name, reason: 'unreadable' })
            }
        }

        return { notes, issues }
    }

    private async listNotesUnsafe(): Promise<Notes> {
        return (await this.scanNotesUnsafe()).notes
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
