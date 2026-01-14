import { ipcMain } from 'electron'
import Store from 'electron-store'
import { Accent } from '../../shared/model/accent'

export function accentHandler(store: Store): void {
    const savedAccent = store.get('accent') as Accent | undefined
    if (!savedAccent) {
        store.set('accent', 'Indigo')
    }

    ipcMain.handle('set:accent', (_, accent: Accent) => {
        store.set('accent', accent)
    })

    ipcMain.handle('get:accent', () => {
        return store.get('accent')
    })
}
