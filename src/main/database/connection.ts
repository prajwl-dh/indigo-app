import { createClient, type Client } from '@libsql/client'

import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'

export function createDatabaseConnection(dbPath: string): {
    db: LibSQLDatabase<Record<string, never>> & {
        $client: Client
    }
    sqlite: Client
    close: () => void
} {
    const sqlite = createClient({ url: `file:${dbPath}` })
    const db = drizzle(sqlite)

    return {
        db,
        sqlite,
        close: () => sqlite.close()
    }
}
