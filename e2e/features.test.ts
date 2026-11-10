import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const OPEN_TIMEOUT_MS = 30_000
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'

type RunningApp = {
    app: ElectronApplication
    page: Page
    dataDirectory: string
    home: string
}

const running: RunningApp[] = []
const tempHomes: string[] = []

async function launch(existing?: RunningApp): Promise<RunningApp> {
    const home = existing?.home ?? (await mkdtemp(join(tmpdir(), 'indigo-e2e-')))
    if (!existing) tempHomes.push(home)
    const dataDirectory = existing?.dataDirectory ?? join(home, '.indigo')
    const args = [ROOT]
    if (process.platform === 'linux') args.push('--no-sandbox', '--disable-gpu')

    const app = await electron.launch({
        args,
        env: {
            ...process.env,
            HOME: home,
            INDIGO_DATA_DIR: dataDirectory
        }
    })

    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'New note' }).first().waitFor({
        state: 'visible',
        timeout: OPEN_TIMEOUT_MS
    })

    const instance = { app, page, dataDirectory, home }
    running.push(instance)
    return instance
}

async function quit(instance: RunningApp): Promise<void> {
    const index = running.indexOf(instance)
    if (index !== -1) running.splice(index, 1)

    const closed = instance.app.waitForEvent('close').catch(() => undefined)
    await instance.app.evaluate(({ app }) => app.quit()).catch(() => undefined)
    await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 10_000))])
    await instance.app.close().catch(() => undefined)
}

async function waitUntil<T>(
    check: () => Promise<T | false | null | undefined>,
    message: string,
    timeoutMs = OPEN_TIMEOUT_MS
): Promise<T> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const found = await check().catch(() => null)
        if (found) return found as T
        await new Promise((resolve) => setTimeout(resolve, 50))
    }
    throw new Error(message)
}

async function startNote(page: Page): Promise<void> {
    const before = await page.locator('.note-row').count()
    await page.getByRole('button', { name: 'New note' }).first().click()

    await waitUntil(
        async () => (await page.locator('.note-row').count()) === before + 1,
        'The new note did not appear in the list.'
    )
    await waitUntil(
        async () => (await page.locator('.note-title').inputValue()) === '',
        'The new note editor did not become active.'
    )
}

async function createNote(page: Page, title: string, body: string): Promise<void> {
    await startNote(page)

    const titleInput = page.getByLabel('Note title')
    await titleInput.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
    await titleInput.fill(title)

    const editor = page.locator('.note-body .bn-editor').first()
    await editor.click()
    await page.keyboard.type(body)
}

function paragraphBody(value: string): string {
    return JSON.stringify([
        {
            type: 'paragraph',
            props: { textAlignment: 'left' },
            content: [{ type: 'text', text: value, styles: {} }],
            children: []
        }
    ])
}

/**
 * Writes a note straight through the bridge. Search, saved views, and the
 * note graph all read saved documents, so this keeps their setup independent
 * of typing speed.
 */
async function seedNote(
    page: Page,
    input: {
        title: string
        body?: string
        tags?: string[]
        isFavorite?: boolean
    }
): Promise<void> {
    await page.evaluate(async (payload) => {
        type Bridge = {
            notes: {
                create: (input?: Record<string, never>) => Promise<{ id: string }>
                update: (patch: { id: string } & Record<string, unknown>) => Promise<unknown>
            }
        }
        const indigo = (window as unknown as { indigo: Bridge }).indigo
        const note = await indigo.notes.create()
        await indigo.notes.update({ id: note.id, ...payload })
    }, input)
}

async function waitForSavedNote(
    dataDirectory: string,
    title: string,
    timeoutMs = 10_000
): Promise<Record<string, unknown>> {
    const deadline = Date.now() + timeoutMs
    const notesDirectory = join(dataDirectory, 'notes')

    while (Date.now() < deadline) {
        try {
            const files = (await readdir(notesDirectory)).filter(
                (file) => file.endsWith('.json') && !file.startsWith('_tags')
            )
            for (const file of files) {
                const note = JSON.parse(
                    await readFile(join(notesDirectory, file), 'utf8')
                ) as Record<string, unknown>
                if (note.title === title) return note
            }
        } catch {
            // The folder may not exist for the first few milliseconds.
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
    }

    throw new Error(`Timed out waiting for "${title}" to reach disk.`)
}

type SavedNote = Record<string, unknown>

async function readNotes(dataDirectory: string): Promise<SavedNote[]> {
    const notesDirectory = join(dataDirectory, 'notes')
    const files = (await readdir(notesDirectory)).filter(
        (file) => file.endsWith('.json') && !file.startsWith('_tags')
    )
    return Promise.all(
        files.map(
            async (file) =>
                JSON.parse(await readFile(join(notesDirectory, file), 'utf8')) as SavedNote
        )
    )
}

async function openRowMenu(page: Page, noteTitle: string): Promise<void> {
    const row = page.locator('.note-row', { hasText: noteTitle }).first()
    await row.hover()
    await row.getByRole('button', { name: `Options for ${noteTitle}` }).click()
}

afterEach(async () => {
    while (running.length > 0) {
        const instance = running[running.length - 1]
        await quit(instance)
    }

    await Promise.all(tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

describe('pinned notes', () => {
    it('holds a note above the rest and remembers it after a relaunch', async () => {
        const instance = await launch()
        await createNote(instance.page, 'Oldest note', 'Written first')
        await createNote(instance.page, 'Newest note', 'Written second')

        await openRowMenu(instance.page, 'Oldest note')
        await instance.page.getByRole('menuitem', { name: 'Pin note' }).click()

        await instance.page
            .getByText('Pinned', { exact: true })
            .first()
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await waitUntil(async () => {
            const titles = await instance.page.locator('.note-row-title').allTextContents()
            return titles[0] === 'Oldest note' && titles[1] === 'Newest note'
        }, 'The pinned note did not move above the rest.')

        const saved = await waitForSavedNote(instance.dataDirectory, 'Oldest note')
        expect(saved.isPinned).toBe(true)

        await quit(instance)

        const second = await launch(instance)
        await second.page
            .locator('.note-row-title', { hasText: 'Oldest note' })
            .first()
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        const titles = await second.page.locator('.note-row-title').allTextContents()
        expect(titles[0]).toBe('Oldest note')
        expect(titles[1]).toBe('Newest note')

        await quit(second)
    })
})

describe('tasks view', () => {
    it('collects checkbox items and writes the tick back to the note', async () => {
        const instance = await launch()

        // A checklist with two items, one already ticked, written straight to
        // the store so the test does not depend on the editor's shortcuts.
        await instance.page.evaluate(async () => {
            type Bridge = {
                notes: {
                    create: (input?: Record<string, never>) => Promise<{ id: string }>
                    update: (patch: {
                        id: string
                        title?: string
                        body?: string
                    }) => Promise<unknown>
                }
            }
            const indigo = (window as unknown as { indigo: Bridge }).indigo

            const note = await indigo.notes.create()
            // Enough prose above the checklist that revealing the task has to
            // scroll the note body, not merely open it.
            const filler = Array.from({ length: 28 }, (_, index) => ({
                id: `filler-${index}`,
                type: 'paragraph',
                props: {},
                content: [
                    {
                        type: 'text',
                        text: `Filler paragraph ${index + 1} keeps the checklist below the fold.`,
                        styles: {}
                    }
                ],
                children: []
            }))

            await indigo.notes.update({
                id: note.id,
                title: 'Groceries',
                body: JSON.stringify([
                    ...filler,
                    {
                        id: 'item-milk',
                        type: 'checkListItem',
                        props: { checked: false },
                        content: [{ type: 'text', text: 'Milk', styles: {} }],
                        children: []
                    },
                    {
                        id: 'item-eggs',
                        type: 'checkListItem',
                        props: { checked: true },
                        content: [{ type: 'text', text: 'Eggs', styles: {} }],
                        children: []
                    }
                ])
            })
            return note.id
        })

        await instance.page.reload()
        await instance.page
            .getByRole('button', { name: 'New note' })
            .first()
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        await instance.page.getByRole('button', { name: 'Tasks' }).first().click()

        const milkRow = instance.page.locator('.task-row', { hasText: 'Milk' })
        await milkRow.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        // Open items first, done items sunk below.
        const texts = await instance.page.locator('.task-text').allTextContents()
        expect(texts).toEqual(['Milk', 'Eggs'])

        await milkRow.getByRole('button', { name: 'Mark “Milk” as done' }).click()

        await waitUntil(async () => {
            const notes = await readNotes(instance.dataDirectory)
            const groceries = notes.find((note) => note.title === 'Groceries')
            if (!groceries) return false
            try {
                const blocks = JSON.parse(String(groceries.body)) as Array<{
                    id?: string
                    props?: { checked?: boolean }
                }>
                return blocks.some(
                    (block) => block.id === 'item-milk' && block.props?.checked === true
                )
            } catch {
                return false
            }
        }, 'The ticked item never reached the note on disk.')

        // The note name is gone; the row itself opens the note.
        expect(await instance.page.locator('.task-note').count()).toBe(0)

        // Ticking re-sorts the list, so the row is briefly replaced. Read the
        // cursors with a retry rather than from a possibly detached node.
        await expect
            .poll(
                () =>
                    milkRow
                        .locator('.task-check')
                        .evaluate((element) => getComputedStyle(element).cursor),
                { timeout: OPEN_TIMEOUT_MS }
            )
            .toBe('pointer')
        await expect
            .poll(
                () =>
                    milkRow
                        .locator('.task-text')
                        .evaluate((element) => getComputedStyle(element).cursor),
                { timeout: OPEN_TIMEOUT_MS }
            )
            .toBe('default')

        await milkRow.locator('.task-text').click()
        await waitUntil(
            async () => (await instance.page.getByLabel('Note title').inputValue()) === 'Groceries',
            'Clicking a task did not open its note.'
        )

        // The checklist sits at the bottom of a long note: opening the note is
        // not enough, the task's own block has to be brought into view.
        const milkBlock = instance.page.locator('.bn-block[data-id="item-milk"]').first()
        await milkBlock.waitFor({ state: 'attached', timeout: OPEN_TIMEOUT_MS })

        let flashed = false
        await waitUntil(async () => {
            if (await milkBlock.evaluate((element) => element.getAnimations().length > 0)) {
                flashed = true
            }
            const blockBox = await milkBlock.boundingBox()
            const scrollerBox = await instance.page.locator('.editor-scroll').boundingBox()
            if (!blockBox || !scrollerBox) return false
            const visible =
                blockBox.y >= scrollerBox.y - 1 &&
                blockBox.y + blockBox.height <= scrollerBox.y + scrollerBox.height + 1
            return flashed && visible
        }, 'Clicking a task did not scroll its block into view.')

        // Ticking a task while its note is open must not close the note.
        const eggsRow = instance.page.locator('.task-row', { hasText: 'Eggs' })
        await eggsRow.getByRole('button', { name: 'Mark “Eggs” as not done' }).click()

        await waitUntil(async () => {
            const notes = await readNotes(instance.dataDirectory)
            const groceries = notes.find((note) => note.title === 'Groceries')
            if (!groceries) return false
            try {
                const blocks = JSON.parse(String(groceries.body)) as Array<{
                    id?: string
                    props?: { checked?: boolean }
                }>
                return blocks.some(
                    (block) => block.id === 'item-eggs' && block.props?.checked === false
                )
            } catch {
                return false
            }
        }, 'Ticking a task in the open note did not reach disk.')

        expect(await instance.page.getByLabel('Note title').inputValue()).toBe('Groceries')

        await quit(instance)
    })
})

describe('export as Markdown', () => {
    it('writes a readable Markdown file into the downloads folder', async () => {
        const instance = await launch()
        await createNote(instance.page, 'Exported wonder', 'Some prose worth keeping')

        await openRowMenu(instance.page, 'Exported wonder')
        await instance.page.getByRole('menuitem', { name: 'Export…' }).click()

        const dialog = instance.page.locator('.dialog-panel').filter({ hasText: 'Export note' })
        await dialog.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await dialog.getByRole('button', { name: /HTML/ }).waitFor({ state: 'visible' })
        await dialog.getByRole('button', { name: /Markdown/ }).click()

        await instance.page
            .getByText('is in your downloads folder')
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        const downloads = join(instance.dataDirectory, 'downloads')
        const exported = await waitUntil(async () => {
            try {
                return (await readdir(downloads)).find((file) => file.endsWith('.md'))
            } catch {
                return undefined
            }
        }, 'The exported file never appeared in the downloads folder.')

        const contents = await readFile(join(downloads, String(exported)), 'utf8')
        expect(contents).toContain('# Exported wonder')
        expect(contents).toContain('Some prose worth keeping')

        await quit(instance)
    })
})

describe('focus mode', () => {
    it('leaves only the page and comes back from the button or Escape', async () => {
        const instance = await launch()
        await createNote(instance.page, 'Focus note', 'Nothing but writing')

        const panel = instance.page.locator('.notes-panel')
        const sidebar = instance.page.locator('.sidebar')
        const titlebar = instance.page.locator('.titlebar')
        const chromeGone = async (): Promise<boolean> =>
            !(await panel.isVisible()) &&
            !(await sidebar.isVisible()) &&
            !(await titlebar.isVisible())
        const chromeBack = async (): Promise<boolean> =>
            (await panel.isVisible()) && (await sidebar.isVisible()) && (await titlebar.isVisible())

        const focusButton = instance.page.getByRole('button', { name: 'Focus mode' }).first()
        await focusButton.click()

        await waitUntil(chromeGone, 'Focus mode left some of the app chrome in place.')
        const leaveFocus = instance.page.getByRole('button', { name: 'Exit focus mode' })
        await leaveFocus.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        await leaveFocus.click()
        await waitUntil(chromeBack, 'The exit button did not bring the app back.')

        await focusButton.click()
        await waitUntil(chromeGone, 'Focus mode did not hide the app a second time.')

        await instance.page.keyboard.press('Escape')
        await waitUntil(chromeBack, 'Escape did not bring the app back.')

        await quit(instance)
    })
})

describe('quick switcher', () => {
    it('opens with the keyboard and jumps to a matching note', async () => {
        const instance = await launch()
        await createNote(instance.page, 'Alpha note', 'Written first')
        await createNote(instance.page, 'Beta note', 'Written second')

        await instance.page.keyboard.press(`${MOD}+P`)

        const palette = instance.page.locator('.palette-panel')
        await palette.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        const input = palette.getByLabel('Find a note or run a command')
        await input.fill('Beta')

        const option = palette.getByRole('option', { name: /Beta note/ })
        await option.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await option.click()

        await waitUntil(
            async () => (await instance.page.getByLabel('Note title').inputValue()) === 'Beta note',
            'The quick switcher did not open the chosen note.'
        )

        await quit(instance)
    })
})

describe('search operators and saved searches', () => {
    it('filters with operators and keeps the query as a view', async () => {
        const instance = await launch()
        await seedNote(instance.page, {
            title: 'Garden plan',
            body: paragraphBody('Tomatoes and basil'),
            tags: ['home']
        })
        await seedNote(instance.page, {
            title: 'Work log',
            body: paragraphBody('Meetings and tomatoes'),
            tags: ['work'],
            isFavorite: true
        })
        await seedNote(instance.page, {
            title: 'Reading list',
            body: paragraphBody('Paper books'),
            tags: []
        })

        await instance.page.reload()
        await instance.page
            .getByRole('button', { name: 'New note' })
            .first()
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        const search = instance.page.getByLabel('Search notes')
        const titles = async (): Promise<string[]> =>
            instance.page.locator('.note-row-title').allTextContents()

        await search.fill('tag:work')
        await waitUntil(async () => {
            const current = await titles()
            return current.length === 1 && current[0] === 'Work log'
        }, 'tag: did not narrow the library to tagged notes.')

        await search.fill('is:favorite')
        await waitUntil(async () => {
            const current = await titles()
            return current.length === 1 && current[0] === 'Work log'
        }, 'is:favorite did not filter to the starred note.')

        await search.fill('has:tag -tag:work')
        await waitUntil(async () => {
            const current = await titles()
            return current.length === 1 && current[0] === 'Garden plan'
        }, 'Combined operators did not AND and negate as documented.')

        await instance.page.getByRole('button', { name: 'Search operators' }).click()
        await instance.page
            .getByText('tag:travel', { exact: true })
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await instance.page.keyboard.press('Escape')

        await search.fill('tag:work')
        await instance.page.getByRole('button', { name: 'Save this search' }).click()

        const dialog = instance.page
            .locator('.dialog-panel')
            .filter({ hasText: 'Save this search' })
        await dialog.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await dialog.getByLabel('Name').fill('Work notes')
        await dialog.getByRole('button', { name: 'Save search' }).click()

        const saved = instance.page.getByRole('button', {
            name: 'Saved search Work notes',
            exact: true
        })
        await saved.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        await instance.page.getByRole('button', { name: 'Clear search' }).click()
        await waitUntil(
            async () => (await titles()).length === 3,
            'Clearing the search did not restore every note.'
        )

        await saved.click()
        await waitUntil(async () => {
            const value = await search.inputValue()
            const current = await titles()
            return value === 'tag:work' && current.length === 1 && current[0] === 'Work log'
        }, 'The saved search did not restore its query.')

        await quit(instance)

        const second = await launch(instance)
        const restored = second.page.getByRole('button', {
            name: 'Saved search Work notes',
            exact: true
        })
        await restored.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await restored.click()

        await waitUntil(
            async () => (await second.page.getByLabel('Search notes').inputValue()) === 'tag:work',
            'The saved search did not survive a relaunch.'
        )

        await quit(second)
    })
})

describe('copy formats', () => {
    it('copies Markdown from the note menu', async () => {
        const instance = await launch()
        await createNote(instance.page, 'Copied note', 'Some words worth keeping')

        await openRowMenu(instance.page, 'Copied note')
        await instance.page.getByRole('menuitem', { name: 'Copy…' }).click()

        const dialog = instance.page.locator('.dialog-panel').filter({ hasText: 'Copy note' })
        await dialog.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        expect(await dialog.getByRole('button', { name: /HTML/ }).count()).toBe(0)
        await dialog.getByRole('button', { name: /Markdown/ }).click()

        await instance.page
            .getByText('Note copied as Markdown.')
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        const clipboardText = await instance.app.evaluate(({ clipboard }) => clipboard.readText())
        expect(clipboardText).toContain('# Copied note')
        expect(clipboardText).toContain('Some words worth keeping')

        await quit(instance)
    })
})

describe('find and replace', () => {
    it('finds every match and replaces them together', async () => {
        const instance = await launch()
        await createNote(instance.page, 'Findable', 'The quiet paper and the quiet ink.')

        await instance.page.keyboard.press(`${MOD}+F`)

        const findInput = instance.page.getByRole('textbox', { name: 'Find in note' })
        await findInput.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await findInput.fill('quiet')

        await waitUntil(async () => {
            const status = await instance.page.locator('.find-status').textContent()
            return status === '1 of 2'
        }, 'The find bar did not count both matches.')

        await instance.page.getByLabel('Replace with').fill('calm')
        await instance.page.getByRole('button', { name: 'Replace all' }).click()

        await waitUntil(async () => {
            const status = await instance.page.locator('.find-status').textContent()
            return status === 'No matches'
        }, 'Replacing every match left the old query in the document.')

        await waitUntil(async () => {
            const notes = await readNotes(instance.dataDirectory)
            const saved = notes.find((note) => note.title === 'Findable')
            return saved ? String(saved.body).includes('calm paper') : false
        }, 'The replacement never reached the note on disk.')

        await instance.page.getByRole('button', { name: 'Close find' }).click()
        await quit(instance)
    })
})

describe('multi-select', () => {
    it('favourites and trashes several notes at once', async () => {
        const instance = await launch()
        await createNote(instance.page, 'First note', 'One')
        await createNote(instance.page, 'Second note', 'Two')
        await createNote(instance.page, 'Third note', 'Three')

        await instance.page.getByRole('button', { name: 'Select notes' }).click()

        const bulk = instance.page.getByRole('toolbar', { name: 'Bulk actions' })
        await bulk.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        await instance.page.locator('.note-row', { hasText: 'First note' }).click()
        await instance.page.locator('.note-row', { hasText: 'Second note' }).click()

        await waitUntil(
            async () => (await bulk.locator('.bulk-count').textContent()) === '2 selected',
            'The bulk bar did not reflect the selected rows.'
        )

        await bulk.getByRole('button', { name: 'Actions' }).click()
        await instance.page.getByRole('menuitem', { name: 'Add to favorites' }).click()

        await waitUntil(async () => {
            const notes = await readNotes(instance.dataDirectory)
            return ['First note', 'Second note'].every(
                (title) => notes.find((note) => note.title === title)?.isFavorite === true
            )
        }, 'Bulk favouriting never reached the notes on disk.')

        await bulk.getByRole('button', { name: 'Select all' }).click()
        await waitUntil(
            async () => (await bulk.locator('.bulk-count').textContent()) === '3 selected',
            'Select all did not select every visible note.'
        )

        await bulk.getByRole('button', { name: 'Actions' }).click()
        await instance.page.getByRole('menuitem', { name: 'Move to trash' }).click()

        await waitUntil(
            async () => (await instance.page.locator('.note-row').count()) === 0,
            'Trashed notes stayed in the main list.'
        )

        await instance.page.getByRole('button', { name: 'Trash' }).first().click()
        await waitUntil(
            async () => (await instance.page.locator('.note-row').count()) === 3,
            'The trashed notes did not appear in the trash view.'
        )

        await quit(instance)
    })
})

describe('note links and graph', () => {
    it('links a note from the slash menu and shows it in the graph', async () => {
        const instance = await launch()
        await createNote(instance.page, 'Target note', 'The destination')
        await createNote(instance.page, 'Source note', 'See this:')

        const editor = instance.page.locator('.note-body .bn-editor').first()
        await editor.click()
        await instance.page.keyboard.type(' /')

        const linkItem = instance.page
            .locator('.bn-suggestion-menu-item', { hasText: 'Link to note' })
            .first()
        await linkItem.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await linkItem.click()

        const picker = instance.page.locator('.note-link-panel')
        await picker.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await picker.getByLabel('Find a note to link').fill('Target')

        const option = picker.getByRole('option', { name: /Target note/ })
        await option.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await option.click()

        await waitUntil(async () => {
            const notes = await readNotes(instance.dataDirectory)
            const source = notes.find((note) => note.title === 'Source note')
            return source ? String(source.body).includes('indigo:note/') : false
        }, 'The note link never reached the source note on disk.')

        const noteLink = editor.locator('a[href^="indigo:note/"]').first()
        await noteLink.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        const cursor = await noteLink.evaluate((element) => getComputedStyle(element).cursor)
        expect(cursor).toBe('pointer')

        // Moving the caret into a link normally opens BlockNote's link toolbar.
        // Note links must not offer edit, open-in-new-tab, or remove actions.
        await instance.page.keyboard.press('ArrowLeft')
        await instance.page.keyboard.press('ArrowLeft')
        await instance.page.waitForTimeout(300)
        expect(await instance.page.locator('.bn-link-toolbar').count()).toBe(0)

        await instance.page
            .locator('.note-row', {
                has: instance.page.locator('.note-row-title', { hasText: /^Target note$/ })
            })
            .click()
        await instance.page.getByRole('button', { name: 'Note graph' }).click()

        const graph = instance.page.locator('.graph-panel')
        await graph.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        const labels = await graph.locator('.graph-node text').allTextContents()
        expect(labels).toContain('Source note')

        // The dot and its title are both targets for opening the note.
        const sourceLabel = graph.locator('.graph-node text', { hasText: 'Source note' }).first()
        const labelCursor = await sourceLabel.evaluate(
            (element) => getComputedStyle(element).cursor
        )
        expect(labelCursor).toBe('pointer')

        await sourceLabel.click()
        await waitUntil(
            async () =>
                (await instance.page.getByLabel('Note title').inputValue()) === 'Source note',
            'Clicking a graph label did not open its note.'
        )

        await quit(instance)
    })
})
