import { ElectronAPI } from '@electron-toolkit/preload'
import { Theme } from 'src/shared/model/theme'

declare global {
    interface Window {
        electron: ElectronAPI
        themeApi: {
            setTheme: (theme: Theme) => Promise<void>
            getTheme: () => Promise<Theme>
        }
        notesApi: {
            createDatabase: () => Promise<string | null>
            loadDatabase: () => Promise<string | null>
        }
    }
}
