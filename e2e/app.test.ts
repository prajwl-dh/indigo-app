import { chmod, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
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

type DataDirectory = {
    home: string
    dataDirectory: string
}

async function launch(existing?: DataDirectory): Promise<RunningApp> {
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

async function closeWindow(instance: RunningApp): Promise<void> {
    const index = running.indexOf(instance)
    if (index !== -1) running.splice(index, 1)

    const closed = instance.page.waitForEvent('close')
    await instance.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.close()
    })
    await closed

    // The window-close handshake flushes before the window goes away. On
    // Linux the app then quits; on macOS it stays open.
    await waitForSavedNote(instance.dataDirectory, 'Close test note')
    await instance.app.evaluate(({ app }) => app.quit()).catch(() => undefined)
    await instance.app.close().catch(() => undefined)
}

async function waitUntil(
    check: () => Promise<boolean>,
    message: string,
    timeoutMs = OPEN_TIMEOUT_MS
): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (await check().catch(() => false)) return
        await new Promise((resolve) => setTimeout(resolve, 50))
    }
    throw new Error(message)
}

async function startNote(page: Page): Promise<void> {
    const before = await page.locator('.note-row').count()
    await page.getByRole('button', { name: 'New note' }).first().click()

    // Creating a note is asynchronous: wait until its (empty) editor is the
    // one on screen before typing, or the text lands in the previous note.
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

afterEach(async () => {
    while (running.length > 0) {
        const instance = running[running.length - 1]
        await quit(instance)
    }

    await Promise.all(tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

describe('save before leaving the app', () => {
    it('writes the last edit before quitting and shows it after relaunch', async () => {
        const first = await launch()
        await createNote(first.page, 'Quit test note', 'Typed just before quit')

        await quit(first)

        const saved = await waitForSavedNote(first.dataDirectory, 'Quit test note')
        expect(saved.body).toContain('Typed just before quit')

        const second = await launch(first)
        await second.page
            .locator('.note-row-title', { hasText: 'Quit test note' })
            .first()
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await quit(second)
    })

    it('writes the last edit before closing the window and shows it after relaunch', async () => {
        const first = await launch()
        await createNote(first.page, 'Close test note', 'Typed just before close')

        await closeWindow(first)

        const saved = await waitForSavedNote(first.dataDirectory, 'Close test note')
        expect(saved.body).toContain('Typed just before close')

        const second = await launch(first)
        await second.page
            .locator('.note-row-title', { hasText: 'Close test note' })
            .first()
            .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
        await quit(second)
    })

    it.skipIf(process.platform === 'win32')(
        'keeps the editor open when a failed save would otherwise navigate away',
        async () => {
            const instance = await launch()
            await createNote(instance.page, 'First note', 'First body')

            await startNote(instance.page)
            const titleInput = instance.page.getByLabel('Note title')
            await titleInput.waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })
            await titleInput.fill('Second note')

            const notesDirectory = join(instance.dataDirectory, 'notes')
            await chmod(notesDirectory, 0o500)

            try {
                const editor = instance.page.locator('.note-body .bn-editor').first()
                await editor.click()
                await instance.page.keyboard.type('Unsaved body')

                await instance.page.locator('.note-row', { hasText: 'First note' }).first().click()

                await instance.page
                    .getByRole('button', { name: 'Save failed · Retry' })
                    .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

                // Navigation was refused, so the second note is still open.
                await expect(titleInput.inputValue()).resolves.toBe('Second note')
            } finally {
                await chmod(notesDirectory, 0o700)
            }

            await instance.page.getByRole('button', { name: 'Save failed · Retry' }).click()
            await instance.page
                .getByText('Saved', { exact: true })
                .first()
                .waitFor({ state: 'visible', timeout: OPEN_TIMEOUT_MS })

            await quit(instance)
        }
    )
})
