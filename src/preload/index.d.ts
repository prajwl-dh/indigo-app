import { ElectronAPI } from '@electron-toolkit/preload'
import { Theme } from 'src/shared/model/theme'

declare global {
    interface Window {
        electron: ElectronAPI
        themeApi: {
            setTheme: (theme: Theme) => Promise<void>
            getTheme: () => Promise<Theme>
        }
        databaseApi: {
            createDatabase: () => Promise<string | null>
            loadDatabase: () => Promise<string | null>
            getActiveDatabase: () => Promise<string | null>
            deleteActiveDatabase: () => Promise<void>
        }
        notesApi: {
            createNote: () => Promise<void>
        }
    }
}
