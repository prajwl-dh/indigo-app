export type Note = {
    id: number
    title?: string
    body?: string
    lastModified?: string
    isFavourite?: boolean
    folderId?: number
    isInTrash?: boolean
}

export type Notes = Array<Note>

export type Folder = {
    id: number
    name?: string
}

export type Folders = Array<Folder>
