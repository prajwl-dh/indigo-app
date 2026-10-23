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
}

export type NotePatch = Partial<Omit<Note, 'id' | 'createdAt'>> & { id: string }

export type Notes = Note[]

export type Tag = {
    name: string
    createdAt: string
}

export type Tags = Tag[]

export type NotesView = 'all' | 'favorites' | 'trash'

export type NotesSort = 'updated' | 'title'

export type StorageInfo = {
    notesDirectory: string
    noteCount: number
}
