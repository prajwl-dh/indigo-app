import Database from 'better-sqlite3'

export function createDatabase(dbPath: string): void {
    const sqlite = new Database(dbPath)

    sqlite.exec(`
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

    sqlite.close()
}
