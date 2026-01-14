import { ipcMain } from 'electron'
import Store from 'electron-store'
import { Accent } from '../../shared/model/accent'

const ACCENTS = ['indigo', 'rose', 'orange', 'teal', 'blue', 'violet'] as const

const isAccent = (v: unknown): v is Accent => ACCENTS.includes(v as Accent)

export function accentHandler(store: Store): void {
    const savedAccent = store.get('accent')
    store.set('accent', isAccent(savedAccent) ? savedAccent : 'indigo')

    ipcMain.handle('set:accent', (_, accent: Accent) => {
        store.set('accent', accent)
        return store.get('accent')
    })

    ipcMain.handle('get:accent', () => {
        return store.get('accent')
    })
}
