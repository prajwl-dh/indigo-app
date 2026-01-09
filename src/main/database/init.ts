import Database from 'better-sqlite3'
import { BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3'

export function initDatabase(dbPath: string): BetterSQLite3Database<Record<string, never>> & {
    $client: Database.Database
} {
    const sqlite = new Database(dbPath)
    const db = drizzle(sqlite)

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      last_modified TEXT NOT NULL,
      is_favourite INTEGER NOT NULL DEFAULT 0,
      folder_id TEXT NOT NULL
    );
  `)

    sqlite.close()

    return db
}
