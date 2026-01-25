import { Client } from '@libsql/client'

export async function seedDatabase(sqlite: Client): Promise<void> {
    const timestamp = new Date().toISOString()

    await sqlite.execute(`
        INSERT INTO folders (name) VALUES 
        ('Personal'), 
        ('Work Projects');
    `)

    await sqlite.execute(`
        INSERT INTO notes (title, body, last_modified, is_favourite, folder_id, is_in_trash) VALUES 
        ('Grocery List', 'Milk, Eggs, Bread, Coffee', '${timestamp}', 0, 1, 0),
        ('Weekend Plans', 'Hiking on Saturday, Brunch on Sunday', '${timestamp}', 0, 1, 0),
        ('Meeting Notes', 'Discussed Q3 roadmap and deadlines.', '${timestamp}', 0, 2, 0),
        ('Bug Report', 'Fix login issue on mobile view.', '${timestamp}', 0, 2, 0),
        ('Random Thought', 'Need to buy new headphones.', '${timestamp}', 0, 0, 0),
        ('Startup Idea', 'A platform for developers to share setups.', '${timestamp}', 1, 0, 0),
        ('Old Draft', 'This is no longer needed.', '${timestamp}', 0, 0, 1);
    `)
}
