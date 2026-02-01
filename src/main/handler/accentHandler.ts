import { ipcMain } from 'electron'
import Store from 'electron-store'
import { Accent, accents } from '../../shared/model/accent'

function getValidAccent(accent: unknown): Accent {
    return accents.includes(accent as Accent) ? (accent as Accent) : 'blue'
}

export function accentHandler(store: Store): void {
    // Initialize accent
    const savedAccent = store.get('accent')
    store.set('accent', getValidAccent(savedAccent))

    // Handle setting a new accent
    ipcMain.handle('set:accent', (_, accent: unknown) => {
        const validAccent = getValidAccent(accent)
        store.set('accent', validAccent)
        return store.get('accent')
    })

    // Handle getting the current accent
    ipcMain.handle('get:accent', () => store.get('accent'))
}
