import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const notes = sqliteTable('notes', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    lastModified: text('last_modified').notNull(),
    isFavourite: integer('is_favourite', { mode: 'boolean' }).notNull().default(false),
    folderId: integer('folder_id').notNull(),
    isInTrash: integer('is_in_trash', { mode: 'boolean' }).notNull().default(false)
})

export const folders = sqliteTable('folders', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique()
})
