import { ipcMain } from 'electron'
import Store from 'electron-store'
import { createDatabaseConnection } from '../database/connection'
import { notes } from '../database/schema'
import { getActiveDatabasePath } from '../util/activeDatabasePathUtils'

export async function notesHandler(store: Store): Promise<void> {
    const activeDatabase = await getActiveDatabasePath(store)

    if (!activeDatabase) {
        return
    }

    const connection = createDatabaseConnection(activeDatabase)
    console.log(connection)

    ipcMain.handle('create:note', async () => {
        const activeDatabase = await getActiveDatabasePath(store)
        if (!activeDatabase) {
            return
        }

        await connection.db.insert(notes).values({
            title: 'Welcome',
            body: 'Your notes database is ready.',
            lastModified: new Date().toISOString(),
            isFavourite: false,
            folderId: ''
        })
    })
}
