import { app } from 'electron'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Everything Indigo owns lives in one visible folder in the home directory.
 * INDIGO_DATA_DIR is an escape hatch for portable installs and automated
 * tests; when it is set, the real folder is never read or migrated.
 */
function configuredDirectory(): string | null {
    const value = process.env.INDIGO_DATA_DIR?.trim()
    return value ? value : null
}

export function indigoDirectory(): string {
    return configuredDirectory() ?? join(homedir(), '.indigo')
}

/** Notes are plain files, kept apart from the configuration file. */
export function notesDirectory(): string {
    return join(indigoDirectory(), 'notes')
}

async function hasFiles(directory: string): Promise<boolean> {
    try {
        const entries = await readdir(directory)
        return entries.length > 0
    } catch {
        return false
    }
}

/**
 * Earlier versions kept notes and configuration inside Electron's userData
 * folder. Copy them into ~/.indigo once, without deleting the originals, so an
 * upgrade never loses a note.
 */
export async function migrateLegacyStorage(): Promise<void> {
    // A redirected data folder is deliberately isolated; importing from the
    // machine's real application-data folder would break that promise.
    if (configuredDirectory()) return

    const legacyRoot = app.getPath('userData')
    const root = indigoDirectory()
    const notes = notesDirectory()

    await mkdir(root, { recursive: true })

    const legacyConfig = join(legacyRoot, 'config.json')
    const config = join(root, 'config.json')
    if (!existsSync(config) && existsSync(legacyConfig)) {
        await copyFile(legacyConfig, config).catch(() => undefined)
    }

    const legacyNotes = join(legacyRoot, 'notes')
    if (legacyNotes === notes || !existsSync(legacyNotes)) return
    if (await hasFiles(notes)) return

    await mkdir(notes, { recursive: true })
    const entries = await readdir(legacyNotes, { withFileTypes: true })
    for (const entry of entries) {
        if (!entry.isFile()) continue
        await copyFile(join(legacyNotes, entry.name), join(notes, entry.name)).catch(
            () => undefined
        )
    }
}
