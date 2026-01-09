import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import { Theme } from '../shared/model/theme'

// Custom APIs for renderer
const themeApi = {
    setTheme: (theme: Theme) => ipcRenderer.invoke('set:theme', theme),
    getTheme: () => ipcRenderer.invoke('get:theme')
}

const notesApi = {
    createDatabase: () => ipcRenderer.invoke('create:database'),
    loadDatabase: () => ipcRenderer.invoke('load:database')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('themeApi', themeApi)
        contextBridge.exposeInMainWorld('notesApi', notesApi)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore (define in dts)
    window.themeApi = themeApi
    // @ts-ignore (define in dts)
    window.notesApi = notesApi
}
