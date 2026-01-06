import { ipcMain, nativeTheme } from 'electron'
import { Theme } from '../../shared/model/theme'

export function themeController(): void {
  ipcMain.handle('set:theme', (_, theme: Theme) => {
    nativeTheme.themeSource = theme
  })

  ipcMain.handle('get:theme', () => {
    return nativeTheme.themeSource
  })
}
