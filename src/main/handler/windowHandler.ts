import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'

function windowFor(event: IpcMainInvokeEvent): BrowserWindow | null {
    return BrowserWindow.fromWebContents(event.sender)
}

export function registerWindowHandlers(): void {
    ipcMain.handle('window:minimize', (event) => {
        windowFor(event)?.minimize()
    })

    ipcMain.handle('window:toggle-maximize', (event) => {
        const window = windowFor(event)
        if (!window) return false
        if (window.isMaximized()) {
            window.unmaximize()
        } else {
            window.maximize()
        }
        return window.isMaximized()
    })

    ipcMain.handle('window:close', (event) => {
        windowFor(event)?.close()
    })

    ipcMain.handle('window:is-maximized', (event) => {
        const window = windowFor(event)
        return window?.isMaximized() ?? false
    })
}

export function attachWindowStateEvents(window: BrowserWindow): void {
    const send = (): void => {
        if (window.isDestroyed()) return
        window.webContents.send('window:maximized-changed', window.isMaximized())
    }

    window.on('maximize', send)
    window.on('unmaximize', send)
    window.on('enter-full-screen', send)
    window.on('leave-full-screen', send)
}
