import { ElectronAPI } from '@electron-toolkit/preload'
import { Accent } from 'src/shared/model/accent'
import { Note, Notes } from 'src/shared/model/note'
import { Theme } from 'src/shared/model/theme'

declare global {
    interface Window {
        electron: ElectronAPI
        themeApi: {
            setTheme: (theme: Theme) => Promise<void>
            getTheme: () => Promise<Theme>
        }
        accentApi: {
            setAccent: (accent: Accent) => Promise<void>
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
            getNote: (id: number) => Promise<Note>
            getAllNotes: () => Promise<Notes>
        }
    }
}
