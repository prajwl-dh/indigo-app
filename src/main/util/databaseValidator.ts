import fs from 'fs/promises'

export async function isValidIndigoDatabase(filePath: string): Promise<boolean> {
    try {
        const fd = await fs.open(filePath, 'r')
        const buffer = Buffer.alloc(16)

        await fd.read(buffer, 0, 16, 0)
        await fd.close()

        return buffer.toString('utf8', 0, 16) === 'SQLite format 3\0'
    } catch {
        return false
    }
}
