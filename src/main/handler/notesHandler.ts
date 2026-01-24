import { eq } from 'drizzle-orm'
import { ipcMain } from 'electron'
import Store from 'electron-store'
import { Note } from '../../shared/model/note'
import { createDatabaseConnection } from '../database/connection'
import { folders, notes } from '../database/schema'
import { getActiveDatabasePath } from '../util/activeDatabasePathUtils'

export async function notesHandler(store: Store): Promise<void> {
    const activeDatabase = await getActiveDatabasePath(store)
    if (!activeDatabase) {
        return
    }

    const connection = createDatabaseConnection(activeDatabase)

    // create a new note
    ipcMain.handle('create:note', async () => {
        try {
            const [inserted] = await connection.db
                .insert(notes)
                .values({
                    title: 'Welcome',
                    body: 'Your notes database is ready.',
                    lastModified: new Date().toISOString(),
                    isFavourite: false,
                    folderId: 0,
                    isInTrash: false
                })
                .returning()

            return inserted
        } catch (error: unknown) {
            console.error('[create:note]', error)
            throw new Error('Failed to create note')
        }
    })

    // update a note
    ipcMain.handle('update:note', async (_event, payload: Note) => {
        try {
            const { id, title, body, isFavourite, folderId, isInTrash } = payload

            const [updated] = await connection.db
                .update(notes)
                .set({
                    title,
                    body,
                    isFavourite,
                    folderId,
                    isInTrash,
                    lastModified: new Date().toISOString()
                })
                .where(eq(notes.id, id))
                .returning()

            return updated
        } catch (error: unknown) {
            console.error('[update:note]', error)
            throw new Error('Failed to update note with id: ' + payload.id)
        }
    })

    // delete a note
    ipcMain.handle('delete:note', async (_event, payload: Note) => {
        try {
            await connection.db.delete(notes).where(eq(notes.id, payload.id))
            return true
        } catch (error: unknown) {
            console.error('[delete:note]', error)
            throw new Error('Failed to delete note with id: ' + payload.id)
        }
    })

    // get a single note by id
    ipcMain.handle('get:note', async (_event, id: number) => {
        try {
            const note = await connection.db.select().from(notes).where(eq(notes.id, id)).get()
            return note
        } catch (error) {
            console.error('[get:note]', error)
            throw new Error('Failed to get note with id: ' + id)
        }
    })

    // get all notes
    ipcMain.handle('get:notes', async () => {
        try {
            const allNotes = await connection.db.select().from(notes).all()
            return allNotes
        } catch (error) {
            console.error('[get:all-notes]', error)
            throw new Error('Failed to get all notes')
        }
    })

    // get a folder by id
    ipcMain.handle('get:folder', async (_event, id: number) => {
        try {
            const folder = await connection.db
                .select()
                .from(folders)
                .where(eq(folders.id, id))
                .get()
            return folder
        } catch (error) {
            console.error('[get:folder]', error)
            throw new Error('Failed to get folder with id: ' + id)
        }
    })

    // get all folders
    ipcMain.handle('get:folders', async () => {
        try {
            const allFolders = await connection.db.select().from(folders).all()
            return allFolders
        } catch (error) {
            console.error('[get:folders]', error)
            throw new Error('Failed to get all folders')
        }
    })

    // // create a new folder
    // ipcMain.handle('create:folder', async (_event, ) => {
    //     try {
    //         const [inserted] = await connection.db.insert(folders).values()
    //     }
    // })
}
