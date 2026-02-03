import { ElectronAPI } from '@electron-toolkit/preload'
import { Accent } from 'src/shared/model/accent'
import { Folder, Folders, Note, Notes } from 'src/shared/model/note'
import { Theme } from 'src/shared/model/theme'

declare global {
    interface Window {
        electron: ElectronAPI
        themeApi: {
            setTheme: (theme: Theme) => Promise<Theme>
            getTheme: () => Promise<Theme>
        }
        accentApi: {
            setAccent: (accent: Accent) => Promise<Accent>
            getAccent: () => Promise<Accent>
        }
        databaseApi: {
            createDatabase: () => Promise<string | null>
            loadDatabase: () => Promise<string | null>
            getActiveDatabasePath: () => Promise<string | null>
            deleteActiveDatabasePath: () => Promise<void>
        }
        notesApi: {
            createNote: () => Promise<Note>
            updateNote: (payload: Note) => Promise<Note>
            deleteNote: (payload: Note) => Promise<boolean>
            deleteAllNoteInTrash: () => Promise<boolean>
            getNote: (id: number) => Promise<Note>
            getAllNotes: () => Promise<Notes>
            getFolder: (id: number) => Promise<Folder>
            getAllFolders: () => Promise<Folders>
            createFolder: (payload: Folder) => Promise<Folder>
            updateFolder: (payload: Folder) => Promise<Folder>
            deleteFolder: (payload: Folder) => Promise<boolean>
        }
    }
}
