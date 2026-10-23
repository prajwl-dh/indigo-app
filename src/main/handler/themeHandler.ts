import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import Store from 'electron-store'
import { isTheme, type Theme } from '../../shared/model/theme'

export const WINDOW_BACKGROUND = {
    light: '#f4f1ea',
    dark: '#141210'
} as const

export function currentWindowBackground(): string {
    return nativeTheme.shouldUseDarkColors ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light
}

export function applyWindowBackgrounds(): void {
    const background = currentWindowBackground()
    for (const window of BrowserWindow.getAllWindows()) {
        window.setBackgroundColor(background)
    }
}

export function notifyTheme(): void {
    const payload = {
        theme: nativeTheme.themeSource,
        resolved: nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    }
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('theme:changed', payload)
    }
    applyWindowBackgrounds()
}

export function themeHandler(store: Store): void {
    const saved = store.get('theme')
    nativeTheme.themeSource = isTheme(saved) ? saved : 'system'

    ipcMain.handle('theme:get', () => nativeTheme.themeSource)

    ipcMain.handle('theme:set', (_event, value: unknown): Theme => {
        const theme: Theme = isTheme(value) ? value : 'system'
        nativeTheme.themeSource = theme
        store.set('theme', theme)
        notifyTheme()
        return theme
    })

    nativeTheme.on('updated', notifyTheme)
}
