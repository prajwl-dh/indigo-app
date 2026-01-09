import { dialog, ipcMain } from 'electron'
import Store from 'electron-store'
import { isValidIndigoDatabase } from '../database/databaseChecker'
import { initDatabase } from '../database/init'

export function databaseController(store: Store): void {
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
        store.set('activeDatabase', result.filePath)
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

        const valid = await isValidIndigoDatabase(filePath)
        if (!valid) {
            dialog.showErrorBox(
                'Invalid File',
                'The selected file is not a valid Indigo database file.'
            )
            return null
        }

        store.set('activeDatabase', filePath)
        return filePath
    })

    ipcMain.handle('get:activeDatabase', async () => {
        const filePath = store.get('activeDatabase') as string | undefined

        if (!filePath) {
            return null
        }

        const valid = await isValidIndigoDatabase(filePath)
        if (!valid) {
            store.delete('activeDatabase')
            return null
        }

        return filePath
    })
}
