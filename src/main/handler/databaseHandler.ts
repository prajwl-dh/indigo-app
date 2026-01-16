import { app, dialog, ipcMain } from 'electron'
import Store from 'electron-store'
import { createDatabase } from '../database/migration'
import {
    deleteActiveDatabasePath,
    getActiveDatabasePath,
    truncateActiveDatabasePath
} from '../util/activeDatabasePathUtils'
import { isValidIndigoDatabase } from '../util/databaseValidator'

export function databaseHandler(store: Store): void {
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

        createDatabase(result.filePath)
        store.set('activeDatabase', result.filePath)

        app.relaunch()
        app.exit(0)

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

        app.relaunch()
        app.exit(0)

        return filePath
    })

    ipcMain.handle('get:activeDatabasePath', async () => {
        const filePath = await getActiveDatabasePath(store)

        if (!filePath) {
            return null
        }

        const valid = await isValidIndigoDatabase(filePath)
        if (!valid) {
            deleteActiveDatabasePath(store)
            return null
        }

        return truncateActiveDatabasePath(filePath, 40)
    })

    ipcMain.handle('delete:activeDatabasePath', () => {
        deleteActiveDatabasePath(store)

        app.relaunch()
        app.exit(0)
    })
}
