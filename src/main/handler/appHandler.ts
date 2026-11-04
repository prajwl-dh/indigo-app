import { randomUUID } from 'node:crypto'
import { ipcMain, nativeTheme } from 'electron'
import Store from 'electron-store'
import type { SavedSearch, SavedSearches } from '../../shared/model/note'
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

const SAVED_SEARCHES_KEY = 'savedSearches'
const MAX_SAVED_SEARCHES = 50
const MAX_SAVED_SEARCH_NAME = 60
const MAX_SAVED_SEARCH_QUERY = 400

function readSavedSearches(configStore: Store): SavedSearches {
    const raw = configStore.get(SAVED_SEARCHES_KEY)
    if (!Array.isArray(raw)) return []

    const seenIds = new Set<string>()
    const seenNames = new Set<string>()
    const searches: SavedSearches = []

    for (const entry of raw) {
        if (!entry || typeof entry !== 'object') continue
        const record = entry as Record<string, unknown>
        const id = typeof record.id === 'string' ? record.id.trim() : ''
        const name = typeof record.name === 'string' ? record.name.trim() : ''
        const query = typeof record.query === 'string' ? record.query.trim() : ''
        const createdAt =
            typeof record.createdAt === 'string' && !Number.isNaN(Date.parse(record.createdAt))
                ? record.createdAt
                : new Date().toISOString()

        if (!id || !name || !query) continue
        if (seenIds.has(id) || seenNames.has(name.toLowerCase())) continue

        seenIds.add(id)
        seenNames.add(name.toLowerCase())
        searches.push({ id, name, query, createdAt })

        if (searches.length >= MAX_SAVED_SEARCHES) break
    }

    return searches
}

function writeSavedSearches(configStore: Store, searches: SavedSearches): void {
    configStore.set(SAVED_SEARCHES_KEY, searches)
}

function cleanSavedSearchName(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Give the saved search a name.')
    const name = value.replace(/\s+/g, ' ').trim().slice(0, MAX_SAVED_SEARCH_NAME)
    if (!name) throw new Error('Give the saved search a name.')
    return name
}

function cleanSavedSearchQuery(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Search for something first.')
    const query = value.trim().slice(0, MAX_SAVED_SEARCH_QUERY)
    if (!query) throw new Error('Search for something first.')
    return query
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

    ipcMain.handle('saved-searches:list', async (): Promise<SavedSearches> => {
        return readSavedSearches(configStore)
    })

    ipcMain.handle('saved-searches:create', async (_event, name: unknown, query: unknown) => {
        const searches = readSavedSearches(configStore)
        const cleanedName = cleanSavedSearchName(name)
        const cleanedQuery = cleanSavedSearchQuery(query)

        if (searches.length >= MAX_SAVED_SEARCHES) {
            throw new Error('Delete a saved search before adding another.')
        }

        if (searches.some((entry) => entry.name.toLowerCase() === cleanedName.toLowerCase())) {
            throw new Error('A saved search already uses that name.')
        }

        const created: SavedSearch = {
            id: randomUUID(),
            name: cleanedName,
            query: cleanedQuery,
            createdAt: new Date().toISOString()
        }
        const next = [...searches, created]
        writeSavedSearches(configStore, next)
        return created
    })

    ipcMain.handle('saved-searches:rename', async (_event, id: unknown, name: unknown) => {
        if (typeof id !== 'string') throw new Error('A saved search identifier is required.')
        const searches = readSavedSearches(configStore)
        const existing = searches.find((entry) => entry.id === id)
        if (!existing) throw new Error('That saved search no longer exists.')

        const cleanedName = cleanSavedSearchName(name)
        if (
            searches.some(
                (entry) => entry.id !== id && entry.name.toLowerCase() === cleanedName.toLowerCase()
            )
        ) {
            throw new Error('A saved search already uses that name.')
        }

        const renamed: SavedSearch = { ...existing, name: cleanedName }
        writeSavedSearches(
            configStore,
            searches.map((entry) => (entry.id === id ? renamed : entry))
        )
        return renamed
    })

    ipcMain.handle('saved-searches:delete', async (_event, id: unknown) => {
        if (typeof id !== 'string') throw new Error('A saved search identifier is required.')
        const searches = readSavedSearches(configStore)
        const next = searches.filter((entry) => entry.id !== id)
        writeSavedSearches(configStore, next)
        return next.length !== searches.length
    })

    /**
     * Hard reset: removes every note Indigo recognizes and its tags, then
     * clears all configuration. Unknown files and backups stay in the notes
     * folder. The renderer reloads after this resolves, so nothing stale
     * survives in memory either.
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
