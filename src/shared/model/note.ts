import type { NoteColor } from './noteColor'

export type Note = {
    id: string
    title: string
    body: string
    lastModified: string
    createdAt: string
    isFavorite: boolean
    isInTrash: boolean
    tags: string[]
    color: NoteColor | null
    /**
     * True only for notes created by Indigo that have never held content.
     * Older note files do not carry this flag, so they are never pruned.
     */
    isDraft?: boolean
}

export type NotePatch = Partial<Omit<Note, 'id' | 'createdAt' | 'isDraft'>> & { id: string }

export type Notes = Note[]

export type Tag = {
    name: string
    createdAt: string
}

export type Tags = Tag[]

export type NotesView = 'all' | 'favorites' | 'trash'

export type NotesSort = 'updated' | 'title'

export type StorageFileIssue = {
    file: string
    reason: 'unreadable' | 'not-a-note'
}

export type TagsFileState = 'ok' | 'missing' | 'corrupt' | 'repaired' | 'unreadable'

export type StorageInfo = {
    notesDirectory: string
    noteCount: number
    /** Files in the notes folder that Indigo skipped and left untouched. */
    skippedFiles: StorageFileIssue[]
    tagsFile: TagsFileState
    /** Name of the backup written when a corrupt tags file was rebuilt. */
    tagsBackup: string | null
}
