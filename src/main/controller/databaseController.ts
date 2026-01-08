import { dialog, ipcMain } from 'electron'
import { initDatabase } from '../../database/init'
import { notes } from '../../database/schema'

export function databaseController(): void {
    ipcMain.handle('create:database', async () => {
        const result = await dialog.showSaveDialog({
            title: 'Create Indigo Database At Your Preferred Location',
            defaultPath: 'notes.indigo',
            filters: [{ name: 'Indigo Database', extensions: ['indigo'] }],
            properties: ['createDirectory', 'showOverwriteConfirmation']
        })

        console.log(result)

        if (result.canceled || !result.filePath) {
            return null
        }

        if (!result.filePath.endsWith('.indigo')) {
            return null
        }

        const db = initDatabase(result.filePath)
        await db.insert(notes).values({
            title: 'Welcome',
            body: 'Your notes database is ready.',
            lastModified: new Date().toISOString(),
            isFavourite: false,
            folderId: ''
        })

        return result.filePath
    })
}
