import { dialog, ipcMain } from 'electron'
import { initDatabase } from '../database/init'

export function databaseController(): void {
    ipcMain.handle('create:database', async () => {
        const result = await dialog.showSaveDialog({
            title: 'Create Indigo Database',
            defaultPath: 'notes.indigo',
            filters: [{ name: 'Indigo Database', extensions: ['indigo'] }],
            properties: ['createDirectory', 'showOverwriteConfirmation']
        })

        if (result.canceled || !result.filePath) {
            return null
        }

        if (!result.filePath.endsWith('.indigo')) {
            return null
        }

        initDatabase(result.filePath)

        return result.filePath
    })

    ipcMain.handle('load:database', async () => {
        const result = await dialog.showOpenDialog({
            title: 'Load Indigo Database',
            filters: [{ name: 'Indigo Database', extensions: ['indigo'] }],
            properties: ['openFile']
        })

        if (result.canceled || result.filePaths.length === 0) {
            return null
        }

        const filePath = result.filePaths[0]

        if (!filePath.endsWith('.indigo')) {
            return null
        }

        return filePath
    })
}
