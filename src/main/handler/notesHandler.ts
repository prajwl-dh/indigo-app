import { ipcMain, shell } from 'electron'
import type { NotePatch, StorageInfo } from '../../shared/model/note'
import { NotesStore } from '../storage/notesStore'
import { notesDirectory } from '../storage/paths'

function friendlyError(error: unknown, fallback: string): Error {
    if (error instanceof Error && error.message) return error
    return new Error(fallback)
}

export async function notesHandler(): Promise<NotesStore> {
    const store = new NotesStore(notesDirectory())
    await store.init()

    ipcMain.handle('notes:list', async () => {
        try {
            return await store.listNotes()
        } catch (error) {
            console.error('[notes:list]', error)
            throw friendlyError(error, 'Could not read your notes folder.')
        }
    })

    ipcMain.handle('notes:get', async (_event, id: unknown) => {
        if (typeof id !== 'string') throw new Error('A note identifier is required.')
        try {
            return await store.getNote(id)
        } catch (error) {
            console.error('[notes:get]', error)
            throw friendlyError(error, 'Could not open that note.')
        }
    })

    ipcMain.handle('notes:create', async (_event, input: unknown) => {
        const options =
            input && typeof input === 'object'
                ? (input as { isFavorite?: unknown; tags?: unknown })
                : {}
        try {
            return await store.createNote({
                isFavorite: options.isFavorite === true,
                tags: Array.isArray(options.tags)
                    ? options.tags.filter((tag): tag is string => typeof tag === 'string')
                    : []
            })
        } catch (error) {
            console.error('[notes:create]', error)
            throw friendlyError(error, 'Could not create a new note.')
        }
    })

    ipcMain.handle('notes:update', async (_event, patch: unknown) => {
        if (!patch || typeof patch !== 'object' || typeof (patch as NotePatch).id !== 'string') {
            throw new Error('A note identifier is required.')
        }
        try {
            return await store.updateNote(patch as NotePatch)
        } catch (error) {
            console.error('[notes:update]', error)
            throw friendlyError(error, 'Could not save this note.')
        }
    })

    ipcMain.handle('notes:duplicate', async (_event, id: unknown) => {
        if (typeof id !== 'string') throw new Error('A note identifier is required.')
        try {
            return await store.duplicateNote(id)
        } catch (error) {
            console.error('[notes:duplicate]', error)
            throw friendlyError(error, 'Could not duplicate this note.')
        }
    })

    ipcMain.handle('notes:delete', async (_event, id: unknown) => {
        if (typeof id !== 'string') throw new Error('A note identifier is required.')
        try {
            return await store.deleteNote(id)
        } catch (error) {
            console.error('[notes:delete]', error)
            throw friendlyError(error, 'Could not delete this note.')
        }
    })

    ipcMain.handle('notes:empty-trash', async () => {
        try {
            return await store.emptyTrash()
        } catch (error) {
            console.error('[notes:empty-trash]', error)
            throw friendlyError(error, 'Could not empty the trash.')
        }
    })

    ipcMain.handle('tags:list', async () => {
        try {
            return await store.listTags()
        } catch (error) {
            console.error('[tags:list]', error)
            throw friendlyError(error, 'Could not read your tags.')
        }
    })

    ipcMain.handle('tags:create', async (_event, name: unknown) => {
        if (typeof name !== 'string') throw new Error('Give the tag a name first.')
        try {
            return await store.createTag(name)
        } catch (error) {
            console.error('[tags:create]', error)
            throw friendlyError(error, 'Could not create that tag.')
        }
    })

    ipcMain.handle('tags:rename', async (_event, oldName: unknown, nextName: unknown) => {
        if (typeof oldName !== 'string' || typeof nextName !== 'string') {
            throw new Error('A tag name is required.')
        }
        try {
            return await store.renameTag(oldName, nextName)
        } catch (error) {
            console.error('[tags:rename]', error)
            throw friendlyError(error, 'Could not rename that tag.')
        }
    })

    ipcMain.handle('tags:delete', async (_event, name: unknown) => {
        if (typeof name !== 'string') throw new Error('A tag name is required.')
        try {
            return await store.deleteTag(name)
        } catch (error) {
            console.error('[tags:delete]', error)
            throw friendlyError(error, 'Could not delete that tag.')
        }
    })

    ipcMain.handle('storage:info', async (): Promise<StorageInfo> => {
        try {
            return await store.getStorageInfo()
        } catch (error) {
            console.error('[storage:info]', error)
            throw friendlyError(error, 'Could not read the notes folder.')
        }
    })

    ipcMain.handle('storage:open-folder', async () => {
        const result = await shell.openPath(store.directoryPath)
        if (result) throw new Error(result)
        return true
    })

    return store
}
