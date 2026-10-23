import { ipcMain, nativeTheme } from 'electron'
import Store from 'electron-store'
import type { NotesStore } from '../storage/notesStore'
import { notifyTheme } from './themeHandler'

/**
 * Keys written by earlier Indigo versions. They are deliberately ignored now
 * that notes live as files in the app's notes folder.
 */
const LEGACY_KEYS = ['activeDatabase'] as const

export function forgetLegacyConfig(store: Store): void {
    for (const key of LEGACY_KEYS) {
        store.delete(key)
    }
}

function restoreDefaults(configStore: Store): void {
    configStore.delete('theme')
    configStore.delete('windowState')
    // Earlier builds saved a global accent; it is no longer part of the app.
    configStore.delete('accent')

    nativeTheme.themeSource = 'system'
    notifyTheme()
}

export function appHandler(configStore: Store, notesStore: NotesStore): void {
    /**
     * Soft reset: clears the interface configuration only (theme and window
     * layout). Notes, tags, and the reader's writing are untouched.
     */
    ipcMain.handle('app:soft-reset', async () => {
        restoreDefaults(configStore)
        return true
    })

    /**
     * Hard reset: removes every note and tag, then clears all configuration.
     * The renderer reloads after this resolves, so nothing stale survives in
     * memory either.
     */
    ipcMain.handle('app:hard-reset', async () => {
        await notesStore.reset()

        configStore.clear()
        configStore.set('theme', 'system')

        nativeTheme.themeSource = 'system'
        notifyTheme()

        return true
    })
}
