export type Note = {
    id: number
    title?: string
    body?: string
    lastModified?: string
    isFavourite?: boolean
    folderId?: string
    isInTrash?: boolean
}

export type Notes = Array<Note>
