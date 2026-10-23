import { ElectronAPI } from '@electron-toolkit/preload'
import type { IndigoApi } from './index'

declare global {
    interface Window {
        electron: ElectronAPI
        indigo: IndigoApi
    }
}

export {}
