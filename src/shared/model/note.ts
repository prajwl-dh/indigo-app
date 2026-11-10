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
     * Pinned notes sit above everything else in their view. Like the note's
     * color, pinning is an organisational act, not a content edit, so it
     * never changes the "Edited …" timestamp.
     */
    isPinned?: boolean
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

export type NotesView = 'all' | 'favorites' | 'tasks' | 'trash'

export type NotesSort = 'updated' | 'title'

/** A search query kept under a name in the sidebar. */
export type SavedSearch = {
    id: string
    name: string
    query: string
    createdAt: string
}

export type SavedSearches = SavedSearch[]

export type NoteTransferFormat = 'text' | 'markdown' | 'html'

export type StorageFileIssue = {
    file: string
    reason: 'unreadable' | 'not-a-note'
}

export type TagsFileState = 'ok' | 'missing' | 'corrupt' | 'repaired' | 'unreadable'
export type NoteExport = {
    /** The file that was written, as an absolute path. */
    path: string
    /** The file name alone, for a quiet confirmation message. */
    filename: string
}

export type StorageInfo = {
    notesDirectory: string
    noteCount: number
    /** Files in the notes folder that Indigo skipped and left untouched. */
    skippedFiles: StorageFileIssue[]
    tagsFile: TagsFileState
    /** Name of the backup written when a corrupt tags file was rebuilt. */
    tagsBackup: string | null
}
