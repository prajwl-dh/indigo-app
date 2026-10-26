import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    Menu,
    nativeTheme,
    screen,
    shell,
    type IpcMainEvent,
    type MenuItemConstructorOptions,
    type Rectangle
} from 'electron'
import contextMenu from 'electron-context-menu'
import Store from 'electron-store'
import { join } from 'node:path'
import icon from '../../resources/icon.png?asset'
import { appHandler, forgetLegacyConfig } from './handler/appHandler'
import { notesHandler } from './handler/notesHandler'
import { indigoDirectory, migrateLegacyStorage } from './storage/paths'
import type { NotesStore } from './storage/notesStore'
import {
    applyWindowBackgrounds,
    currentWindowBackground,
    themeHandler
} from './handler/themeHandler'
import { attachWindowStateEvents, registerWindowHandlers } from './handler/windowHandler'
import { registerUpdateHandlers } from './handler/updateHandler'
import { flushRenderer, type FlushFailure, type FlushResult } from './lifecycle/flush'
import { settleBeforeDestructiveAction } from './lifecycle/quitFlow'

contextMenu({
    showInspectElement: !app.isPackaged,
    showSelectAll: true,
    showCopyImageAddress: false,
    showSaveImageAs: true
})

type WindowState = {
    bounds?: Rectangle
    maximized?: boolean
}

const isMac = process.platform === 'darwin'
const FLUSH_TIMEOUT_MS = 2_000

let notesStoreRef: NotesStore | null = null
let quitting = false
let quitFlowRunning = false
// Set when a window was destroyed after the user chose to close despite a
// failed flush. The renderer may have held unconfirmed edits, so draft pruning
// stays off for the rest of this session even if quitting finds no windows.
let unsafeToPrune = false
const windowCloseInProgress = new WeakSet<BrowserWindow>()
const windowCloseApproved = new WeakSet<BrowserWindow>()

function flushFailureDetail(failure: FlushFailure): string {
    if (failure.reason === 'timeout') {
        return 'The editor did not respond in time. If you continue, the most recent changes may be lost.'
    }
    return failure.message || 'The latest changes could not be saved.'
}

async function confirmQuitAfterSaveFailure(failure: FlushFailure): Promise<'continue' | 'cancel'> {
    const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Quit anyway', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
        title: 'Quit without saving?',
        message: 'Indigo could not confirm that your latest changes were saved.',
        detail: flushFailureDetail(failure)
    })
    return result.response === 0 ? 'continue' : 'cancel'
}

async function confirmCloseAfterSaveFailure(failure: FlushFailure): Promise<'continue' | 'cancel'> {
    const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Close anyway', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
        title: 'Close without saving?',
        message: 'Indigo could not confirm that your latest changes were saved.',
        detail: flushFailureDetail(failure)
    })
    return result.response === 0 ? 'continue' : 'cancel'
}

function flushWindow(window: BrowserWindow): Promise<FlushResult> {
    if (window.isDestroyed()) return Promise.resolve({ ok: true })

    const contents = window.webContents
    if (contents.isDestroyed() || contents.isLoading()) {
        return Promise.resolve({ ok: true })
    }

    return flushRenderer(
        {
            send: (requestId) => contents.send('app:flush', requestId),
            subscribe: (listener) => {
                const handler = (
                    _event: IpcMainEvent,
                    requestId: unknown,
                    error: unknown
                ): void => {
                    if (typeof requestId !== 'string') return
                    listener(
                        requestId,
                        typeof error === 'string' && error.length > 0 ? error : null
                    )
                }
                ipcMain.on('app:flush-complete', handler)
                return () => ipcMain.removeListener('app:flush-complete', handler)
            }
        },
        { timeoutMs: FLUSH_TIMEOUT_MS }
    )
}

async function flushAllWindows(): Promise<FlushResult> {
    const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed())
    if (windows.length === 0) return { ok: true }

    const results = await Promise.all(windows.map(flushWindow))
    const failure = results.find((result) => !result.ok)
    return failure ?? { ok: true }
}

// Ask the renderer to finish its pending save before pruning drafts or
// destroying the window. A renderer that does not answer is handled by a
// finite timeout and a user-visible choice, never an indefinite hang.
app.on('before-quit', (event) => {
    const store = notesStoreRef
    if (quitting || !store) return

    event.preventDefault()
    if (quitFlowRunning) return
    quitFlowRunning = true

    void settleBeforeDestructiveAction({
        flush: flushAllWindows,
        onFailure: confirmQuitAfterSaveFailure,
        action: async (flushOk) => {
            if (flushOk && !unsafeToPrune) {
                try {
                    await store.pruneDrafts()
                } catch (error) {
                    console.error('[quit] could not discard verified empty drafts', error)
                }
            }

            quitting = true
            app.quit()
        },
        log: (message, error) => console.error(`[quit] ${message}`, error ?? '')
    })
        .catch((error) => {
            console.error('[quit] could not finish the quit flow', error)
            quitting = true
            app.quit()
        })
        .finally(() => {
            quitFlowRunning = false
        })
})

function isVisibleOnSomeDisplay(bounds: Rectangle): boolean {
    return screen.getAllDisplays().some((display) => {
        const area = display.workArea
        const horizontalOverlap =
            bounds.x < area.x + area.width - 80 && bounds.x + bounds.width > area.x + 80
        const verticalOverlap =
            bounds.y < area.y + area.height - 80 && bounds.y + bounds.height > area.y + 80
        return horizontalOverlap && verticalOverlap
    })
}

function readWindowState(store: Store): WindowState {
    const stored = store.get('windowState') as WindowState | undefined
    if (!stored || typeof stored !== 'object') return {}

    const bounds = stored.bounds
    const validBounds =
        bounds &&
        Number.isFinite(bounds.x) &&
        Number.isFinite(bounds.y) &&
        Number.isFinite(bounds.width) &&
        Number.isFinite(bounds.height) &&
        bounds.width >= 720 &&
        bounds.height >= 480 &&
        isVisibleOnSomeDisplay(bounds)

    return {
        bounds: validBounds ? bounds : undefined,
        maximized: stored.maximized === true
    }
}

function writeWindowState(window: BrowserWindow, store: Store): void {
    if (window.isDestroyed()) return

    const maximized = window.isMaximized()
    const bounds = maximized ? window.getNormalBounds() : window.getBounds()
    store.set('windowState', { bounds, maximized } satisfies WindowState)
}

function sendToRenderer(channel: string): void {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    window?.webContents.send(channel)
}

function buildApplicationMenu(): void {
    const template: MenuItemConstructorOptions[] = [
        ...(isMac
            ? [
                  {
                      label: app.name,
                      submenu: [
                          { role: 'about' },
                          { type: 'separator' },
                          { role: 'hide' },
                          { role: 'hideOthers' },
                          { role: 'unhide' },
                          { type: 'separator' },
                          { role: 'quit' }
                      ]
                  } satisfies MenuItemConstructorOptions
              ]
            : []),
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Note',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => sendToRenderer('menu:new-note')
                },
                {
                    label: 'Search Notes',
                    accelerator: 'CmdOrCtrl+K',
                    click: () => sendToRenderer('menu:search')
                },
                {
                    label: 'Save Note',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => sendToRenderer('menu:save')
                },
                { type: 'separator' },
                isMac ? { role: 'close' } : { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                ...(isMac
                    ? ([
                          { role: 'pasteAndMatchStyle' },
                          { role: 'delete' },
                          { role: 'selectAll' }
                      ] satisfies MenuItemConstructorOptions[])
                    : ([
                          { role: 'delete' },
                          { role: 'selectAll' }
                      ] satisfies MenuItemConstructorOptions[]))
            ]
        },
        {
            label: 'View',
            submenu: [
                ...(is.dev
                    ? ([
                          { role: 'reload' },
                          { role: 'toggleDevTools' },
                          { type: 'separator' }
                      ] satisfies MenuItemConstructorOptions[])
                    : []),
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                ...(isMac
                    ? ([
                          { role: 'zoom' },
                          { type: 'separator' },
                          { role: 'front' }
                      ] satisfies MenuItemConstructorOptions[])
                    : [])
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Indigo on GitHub',
                    click: () => {
                        void shell.openExternal('https://github.com/prajwl-dh/indigo-app')
                    }
                }
            ]
        }
    ]

    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(store: Store): BrowserWindow {
    const saved = readWindowState(store)
    const bounds = saved.bounds ?? { width: 1180, height: 780 }

    const mainWindow = new BrowserWindow({
        ...bounds,
        minWidth: 720,
        minHeight: 480,
        show: false,
        backgroundColor: currentWindowBackground(),
        title: 'Indigo',
        autoHideMenuBar: true,
        ...(isMac
            ? {
                  titleBarStyle: 'hiddenInset' as const,
                  trafficLightPosition: { x: 18, y: 19 }
              }
            : { frame: false }),
        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, '../preload/index.mjs'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: true
        }
    })

    attachWindowStateEvents(mainWindow)

    let saveTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleSave = (): void => {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
            writeWindowState(mainWindow, store)
        }, 400)
    }

    mainWindow.on('resize', scheduleSave)
    mainWindow.on('move', scheduleSave)
    mainWindow.on('close', (event) => {
        if (saveTimer) clearTimeout(saveTimer)
        writeWindowState(mainWindow, store)

        if (quitting || windowCloseApproved.has(mainWindow)) return

        event.preventDefault()
        if (windowCloseInProgress.has(mainWindow)) return
        windowCloseInProgress.add(mainWindow)

        void settleBeforeDestructiveAction({
            flush: () => flushWindow(mainWindow),
            onFailure: confirmCloseAfterSaveFailure,
            action: (flushOk) => {
                if (!flushOk) unsafeToPrune = true
                windowCloseApproved.add(mainWindow)
                mainWindow.close()
            },
            log: (message, error) => console.error(`[window close] ${message}`, error ?? '')
        })
            .catch((error) => {
                console.error('[window close] could not finish the close flow', error)
            })
            .finally(() => {
                windowCloseInProgress.delete(mainWindow)
            })
    })

    mainWindow.on('ready-to-show', () => {
        if (saved.maximized) mainWindow.maximize()
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        if (/^https?:\/\//i.test(details.url)) {
            void shell.openExternal(details.url)
        }
        return { action: 'deny' }
    })

    mainWindow.webContents.on('will-navigate', (event, url) => {
        const current = mainWindow.webContents.getURL()
        if (url === current) return
        event.preventDefault()
        if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return mainWindow
}

if (!app.requestSingleInstanceLock()) {
    app.quit()
} else {
    app.on('second-instance', () => {
        const window = BrowserWindow.getAllWindows()[0]
        if (!window) return
        if (window.isMinimized()) window.restore()
        window.show()
        window.focus()
    })

    app.whenReady().then(async () => {
        electronApp.setAppUserModelId('com.indigo.app')

        app.on('browser-window-created', (_, window) => {
            optimizer.watchWindowShortcuts(window)
        })

        try {
            await migrateLegacyStorage()
        } catch (error) {
            console.error('[storage] could not migrate earlier files', error)
        }

        const store = new Store({ cwd: indigoDirectory() })
        forgetLegacyConfig(store)

        themeHandler(store)
        registerWindowHandlers()
        registerUpdateHandlers()
        buildApplicationMenu()

        try {
            const notesStore = await notesHandler()
            notesStoreRef = notesStore
            appHandler(store, notesStore)
        } catch (error) {
            console.error('[startup]', error)
            dialog.showErrorBox(
                'Indigo could not open your notes folder',
                'Indigo stores every note as a file inside its configuration folder. Check that the folder is writable and try again.\n\n' +
                    (error instanceof Error ? error.message : String(error))
            )
            app.quit()
            return
        }

        applyWindowBackgrounds()
        createWindow(store)

        nativeTheme.on('updated', applyWindowBackgrounds)

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow(store)
        })
    })
}

app.on('window-all-closed', () => {
    if (!isMac) app.quit()
})
