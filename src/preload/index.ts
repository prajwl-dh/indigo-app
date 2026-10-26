import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import type { Note, NotePatch, Notes, StorageInfo, Tag, Tags } from '../shared/model/note'
import type { NoteColor } from '../shared/model/noteColor'
import type { ResolvedTheme, Theme } from '../shared/model/theme'
import type {
    UpdateCheckResult,
    UpdateDownloadResult,
    UpdateProgress
} from '../shared/model/update'

type ThemeChange = { theme: Theme; resolved: ResolvedTheme }

function on<Payload>(channel: string, callback: (payload: Payload) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, payload: Payload): void => {
        callback(payload)
    }
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
}

const themeApi = {
    get: (): Promise<Theme> => ipcRenderer.invoke('theme:get'),
    set: (theme: Theme): Promise<Theme> => ipcRenderer.invoke('theme:set', theme),
    onChanged: (callback: (change: ThemeChange) => void): (() => void) =>
        on<ThemeChange>('theme:changed', callback)
}

const notesApi = {
    list: (): Promise<Notes> => ipcRenderer.invoke('notes:list'),
    get: (id: string): Promise<Note | null> => ipcRenderer.invoke('notes:get', id),
    create: (input?: {
        isFavorite?: boolean
        tags?: string[]
        color?: NoteColor | null
    }): Promise<Note> => ipcRenderer.invoke('notes:create', input),
    update: (patch: NotePatch): Promise<Note> => ipcRenderer.invoke('notes:update', patch),
    duplicate: (id: string): Promise<Note> => ipcRenderer.invoke('notes:duplicate', id),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('notes:delete', id),
    emptyTrash: (): Promise<number> => ipcRenderer.invoke('notes:empty-trash')
}

const tagsApi = {
    list: (): Promise<Tags> => ipcRenderer.invoke('tags:list'),
    create: (name: string): Promise<Tag> => ipcRenderer.invoke('tags:create', name),
    rename: (oldName: string, nextName: string): Promise<Tag> =>
        ipcRenderer.invoke('tags:rename', oldName, nextName),
    delete: (name: string): Promise<boolean> => ipcRenderer.invoke('tags:delete', name)
}

const storageApi = {
    getInfo: (): Promise<StorageInfo> => ipcRenderer.invoke('storage:info'),
    openFolder: (): Promise<boolean> => ipcRenderer.invoke('storage:open-folder')
}

const windowApi = {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChanged: (callback: (maximized: boolean) => void): (() => void) =>
        on<boolean>('window:maximized-changed', callback)
}

const appApi = {
    softReset: (): Promise<boolean> => ipcRenderer.invoke('app:soft-reset'),
    hardReset: (): Promise<boolean> => ipcRenderer.invoke('app:hard-reset')
}

const menuApi = {
    onNewNote: (callback: () => void): (() => void) => on('menu:new-note', callback),
    onSearch: (callback: () => void): (() => void) => on('menu:search', callback),
    onSave: (callback: () => void): (() => void) => on('menu:save', callback)
}

const updatesApi = {
    getVersion: (): Promise<string> => ipcRenderer.invoke('updates:version'),
    check: (force?: boolean): Promise<UpdateCheckResult> =>
        ipcRenderer.invoke('updates:check', force === true),
    download: (): Promise<UpdateDownloadResult> => ipcRenderer.invoke('updates:download'),
    install: (): Promise<void> => ipcRenderer.invoke('updates:install'),
    openRelease: (): Promise<void> => ipcRenderer.invoke('updates:open-release'),
    onProgress: (callback: (progress: UpdateProgress) => void): (() => void) =>
        on<UpdateProgress>('updates:progress', callback)
}

const indigoApi = {
    platform: process.platform as string,
    app: appApi,
    theme: themeApi,
    notes: notesApi,
    tags: tagsApi,
    storage: storageApi,
    window: windowApi,
    menu: menuApi,
    updates: updatesApi
}

export type IndigoApi = typeof indigoApi

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('indigo', indigoApi)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (defined in d.ts)
    window.electron = electronAPI
    // @ts-ignore (defined in d.ts)
    window.indigo = indigoApi
}
