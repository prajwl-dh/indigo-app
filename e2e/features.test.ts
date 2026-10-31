import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const OPEN_TIMEOUT_MS = 30_000

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

describe('note templates', () => {
    it('creates a meeting note with its prompts ready', async () => {
        const instance = await launch()

        await instance.page
            .getByRole('button', { name: 'New note from template' })
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await instance.page.getByRole('button', { name: 'New note from template' }).click()
        await instance.page.getByRole('menuitem', { name: /Meeting notes/ }).click()

        const titleInput = instance.page.getByLabel('Note title')
        await titleInput.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await waitUntil(
            async () => (await titleInput.inputValue()).startsWith('Meeting notes — '),
            'The template title was not applied.'
        )

        // The prompts are part of the note, not a seed that runs once.
        await instance.page
            .locator('.note-body .bn-editor', { hasText: 'Attendees' })
            .first()
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        await quit(instance)

        const saved = await waitUntil(async () => {
            const notes = await readNotes(instance.dataDirectory)
            return notes.find((note) => String(note.title).startsWith('Meeting notes — ')) ?? null
        }, 'The meeting note never reached disk.')
        expect(String(saved.body)).toContain('Attendees')
        expect(saved.isDraft).toBe(false)
    })

    it('creates a journal page with today in the title', async () => {
        const instance = await launch()

        await instance.page.getByRole('button', { name: 'New note from template' }).click()
        await instance.page.getByRole('menuitem', { name: /Journal page/ }).click()

        const titleInput = instance.page.getByLabel('Note title')
        await titleInput.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await waitUntil(
            async () => (await titleInput.inputValue()).startsWith('Journal — '),
            'The journal title was not applied.'
        )

        // The journal funnel carries the prompts too.
        await instance.page
            .locator('.note-body .bn-editor', { hasText: 'What happened' })
            .first()
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        await quit(instance)
    })
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
                    create: (input: { title: string }) => Promise<{ id: string }>
                    update: (patch: { id: string; body: string }) => Promise<unknown>
                }
            }
            const indigo = (window as unknown as { indigo: Bridge }).indigo

            const note = await indigo.notes.create({ title: 'Groceries' })
            await indigo.notes.update({
                id: note.id,
                body: JSON.stringify([
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

        await quit(instance)
    })
})

describe('export as Markdown', () => {
    it('writes a readable Markdown file into the downloads folder', async () => {
        const instance = await launch()
        await createNote(instance.page, 'Exported wonder', 'Some prose worth keeping')

        await openRowMenu(instance.page, 'Exported wonder')
        await instance.page.getByRole('menuitem', { name: 'Export as Markdown' }).click()

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
    it('hides the notes list in favour of the editor and returns on Escape', async () => {
        const instance = await launch()
        await createNote(instance.page, 'Focus note', 'Nothing but writing')

        const focusButton = instance.page.getByRole('button', { name: 'Focus this note' }).first()
        await focusButton.click()

        const panel = instance.page.locator('.notes-panel')
        await waitUntil(
            async () => !(await panel.isVisible()),
            'The notes list did not yield to the editor.'
        )
        const leaveFocus = instance.page.getByRole('button', { name: 'Leave focus mode' }).first()
        await leaveFocus.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

        await instance.page.keyboard.press('Escape')

        await waitUntil(
            async () => await panel.isVisible(),
            'Escape did not bring the notes list back.'
        )

        await quit(instance)
    })
})
