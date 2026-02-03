import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import { Accent } from '../shared/model/accent'
import { Folder, Note } from '../shared/model/note'
import { Theme } from '../shared/model/theme'

// Custom APIs for renderer
const themeApi = {
    setTheme: (theme: Theme) => ipcRenderer.invoke('set:theme', theme),
    getTheme: () => ipcRenderer.invoke('get:theme')
}

const accentApi = {
    setAccent: (accent: Accent) => ipcRenderer.invoke('set:accent', accent),
    getAccent: () => ipcRenderer.invoke('get:accent')
}

const databaseApi = {
    createDatabase: () => ipcRenderer.invoke('create:database'),
    loadDatabase: () => ipcRenderer.invoke('load:database'),
    getActiveDatabasePath: () => ipcRenderer.invoke('get:activeDatabasePath'),
    deleteActiveDatabasePath: () => ipcRenderer.invoke('delete:activeDatabasePath')
}

const notesApi = {
    createNote: () => ipcRenderer.invoke('create:note'),
    updateNote: (payload: Note) => ipcRenderer.invoke('update:note', payload),
    deleteNote: (payload: Note) => ipcRenderer.invoke('delete:note', payload),
    deleteAllNoteInTrash: () => ipcRenderer.invoke('delete:allNoteInTrash'),
    getNote: (id: number) => ipcRenderer.invoke('get:note', id),
    getAllNotes: () => ipcRenderer.invoke('get:notes'),
    getFolder: (id: number) => ipcRenderer.invoke('get:folder', id),
    getAllFolders: () => ipcRenderer.invoke('get:folders'),
    createFolder: (payload: Folder) => ipcRenderer.invoke('create:folder', payload),
    updateFolder: (payload: Folder) => ipcRenderer.invoke('update:folder', payload),
    deleteFolder: (payload: Folder) => ipcRenderer.invoke('delete:folder', payload)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('themeApi', themeApi)
        contextBridge.exposeInMainWorld('accentApi', accentApi)
        contextBridge.exposeInMainWorld('databaseApi', databaseApi)
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
    window.accentApi = accentApi
    // @ts-ignore (define in dts)
    window.databaseApi = databaseApi
    // @ts-ignore (define in dts)
    window.notesApi = notesApi
}
