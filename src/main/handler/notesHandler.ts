import { eq } from 'drizzle-orm'
import { ipcMain } from 'electron'
import Store from 'electron-store'
import { Note } from '../../shared/model/note'
import { createDatabaseConnection } from '../database/connection'
import { notes } from '../database/schema'
import { getActiveDatabasePath } from '../util/activeDatabasePathUtils'

export async function notesHandler(store: Store): Promise<void> {
    const activeDatabase = await getActiveDatabasePath(store)
    if (!activeDatabase) {
        return
    }

    const connection = createDatabaseConnection(activeDatabase)

    ipcMain.handle('create:note', async () => {
        try {
            const [inserted] = await connection.db
                .insert(notes)
                .values({
                    title: 'Welcome',
                    body: 'Your notes database is ready.',
                    lastModified: new Date().toISOString(),
                    isFavourite: false,
                    folderId: ''
                })
                .returning()

            return inserted
        } catch (error: unknown) {
            console.error('[create:note]', error)
            throw new Error('Failed to create note')
        }
    })

    ipcMain.handle('update:note', async (_event, payload: Note) => {
        try {
            const { id, title, body, isFavourite, folderId } = payload

            const [updated] = await connection.db
                .update(notes)
                .set({ title, body, isFavourite, folderId, lastModified: new Date().toISOString() })
                .where(eq(notes.id, id))
                .returning()

            return updated
        } catch (error: unknown) {
            console.error('[update:note]', error)
            throw new Error('Failed to update note')
        }
    })

    ipcMain.handle('delete:note', async (_event, payload: Note) => {
        try {
            await connection.db.delete(notes).where(eq(notes.id, payload.id))
            return true
        } catch (error: unknown) {
            console.error('[delete:note]', error)
            throw new Error('Failed to delete note')
        }
    })
}
