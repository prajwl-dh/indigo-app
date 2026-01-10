import Database from 'better-sqlite3'
import { BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3'

export function createDatabaseConnection(dbPath: string): {
    db: BetterSQLite3Database<Record<string, never>> & {
        $client: Database.Database
    }
    sqlite: Database.Database
    close: () => void
} {
    const sqlite = new Database(dbPath)
    const db = drizzle(sqlite)

    return {
        db,
        sqlite,
        close: () => sqlite.close()
    }
}
