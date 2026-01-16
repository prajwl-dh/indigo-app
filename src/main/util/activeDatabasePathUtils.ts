import Store from 'electron-store'
import { isValidIndigoDatabase } from './databaseValidator'

export async function getActiveDatabasePath(store: Store): Promise<string | null> {
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

export function deleteActiveDatabasePath(store: Store): void {
    store.delete('activeDatabase')
}

export function truncateActiveDatabasePath(filePath: string, maxLength = 20): string {
    if (filePath.length <= maxLength) return filePath

    const sep = filePath.includes('\\') ? '\\' : '/'
    const parts = filePath.split(sep)
    const fileName = parts.pop()!

    let start = ''
    let i = 0

    while (i < parts.length) {
        const next = start ? start + sep + parts[i] : parts[i]
        if ((next + sep + '..' + sep + fileName).length > maxLength) break
        start = next
        i++
    }

    if (i < parts.length) {
        return `${start}${sep}..${sep}${fileName}`
    } else {
        return `${start}${sep}${fileName}`
    }
}
