import { ipcMain, nativeTheme } from 'electron'
import Store from 'electron-store'
import { Theme } from '../../shared/model/theme'

export function themeHandler(store: Store): void {
    const savedTheme = store.get('theme') as Theme | undefined
    if (savedTheme) {
        nativeTheme.themeSource = savedTheme
    } else {
        nativeTheme.themeSource = 'system'
    }

    ipcMain.handle('set:theme', (_, theme: Theme) => {
        nativeTheme.themeSource = theme
        store.set('theme', theme)
    })

    ipcMain.handle('get:theme', () => {
        return nativeTheme.themeSource
    })
}
