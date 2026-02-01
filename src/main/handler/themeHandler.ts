import { ipcMain, nativeTheme } from 'electron'
import Store from 'electron-store'
import { Theme, themes } from '../../shared/model/theme'

function getValidTheme(theme: unknown): Theme {
    return themes.includes(theme as Theme) ? (theme as Theme) : 'system'
}

export function themeHandler(store: Store): void {
    // Initialize nativeTheme
    const savedTheme = store.get('theme')
    nativeTheme.themeSource = getValidTheme(savedTheme)

    // Handle setting a new theme
    ipcMain.handle('set:theme', (_, theme: Theme) => {
        const validTheme = getValidTheme(theme)
        nativeTheme.themeSource = validTheme
        store.set('theme', theme)
        return store.get('theme')
    })

    // Handle getting the current theme
    ipcMain.handle('get:theme', () => nativeTheme.themeSource)
}
