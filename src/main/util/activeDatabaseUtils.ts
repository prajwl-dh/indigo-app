import Store from 'electron-store'
import { isValidIndigoDatabase } from './databaseValidator'

export async function getActiveDatabase(store: Store): Promise<string | null> {
    const filePath = store.get('activeDatabase') as string | undefined
    if (!filePath) {
        return null
    }

    const valid = await isValidIndigoDatabase(filePath)
    if (!valid) {
        store.delete('activeDatabase')
        return null
    }

    return filePath
}

export function deleteActiveDatabase(store: Store): void {
    store.delete('activeDatabase')
}
