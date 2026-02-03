import { Client } from '@libsql/client'

export async function seedDatabase(sqlite: Client): Promise<void> {
    const timestamp = new Date().toISOString()

    await sqlite.execute(`
        INSERT INTO folders (name) VALUES 
        ('Personal'), 
        ('Work Projects');
    `)

    await sqlite.execute(`
    INSERT INTO notes (title, body, last_modified, is_favorite, folder_id, is_in_trash) VALUES 
    (
        'Weekly Grocery Shopping List',
        'Milk (2L), free-range eggs, whole wheat bread, ground coffee beans, bananas, chicken breast, and olive oil. Check for discounts.',
        '${timestamp}',
        0,
        1,
        0
    ),
    (
        'Plans for the Upcoming Weekend',
        'Saturday: early morning hike at the national park if the weather is good. Sunday: brunch at the new café downtown with Sarah and Mike.',
        '${timestamp}',
        0,
        1,
        0
    ),
    (
        'Q3 Planning Meeting Notes',
        'Reviewed Q3 product roadmap, discussed feature priorities, and agreed on internal deadlines. Need to follow up with design and backend teams.',
        '${timestamp}',
        0,
        2,
        0
    ),
    (
        'Mobile Login Bug Report',
        'Users are experiencing login failures on smaller screen sizes. Issue seems related to the input validation and viewport scaling on mobile devices.',
        '${timestamp}',
        0,
        2,
        0
    ),
    (
        'Quick Personal Reminder',
        'Remember to research and buy new noise-cancelling headphones. Look for good battery life and comfortable fit for long work sessions.',
        '${timestamp}',
        0,
        0,
        0
    ),
    (
        'SaaS Startup Idea Brainstorm',
        'A platform where developers can share their workstation setups, tools, and productivity workflows. Could include screenshots, gear lists, and templates.',
        '${timestamp}',
        1,
        0,
        0
    ),
    (
        'Deprecated Draft Notes',
        'Initial draft for an old feature idea that has been scrapped. Keeping this temporarily for reference, but it can be safely deleted later.',
        '${timestamp}',
        0,
        0,
        1
    );
`)
}
