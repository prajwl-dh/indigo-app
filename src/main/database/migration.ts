import { createClient } from '@libsql/client'

export async function createDatabase(dbPath: string): Promise<void> {
    const sqlite = createClient({ url: `file:${dbPath}` })

    try {
        await sqlite.execute(`
          CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            last_modified TEXT NOT NULL,
            is_favourite INTEGER NOT NULL DEFAULT 0,
            folder_id TEXT NOT NULL,
            is_in_trash INTEGER NOT NULL DEFAULT 0
          );
  `)
    } finally {
        sqlite.close()
    }
}
