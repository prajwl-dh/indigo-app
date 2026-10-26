import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NotesStore } from '../../src/main/storage/notesStore'
import { settleBeforeDestructiveAction } from '../../src/main/lifecycle/quitFlow'
import type { FlushFailure, FlushResult } from '../../src/main/lifecycle/flush'

const TEXT_BODY = JSON.stringify([
    {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Typed at the last moment', styles: {} }],
        children: []
    }
])

const failure: FlushFailure = {
    ok: false,
    reason: 'error',
    message: 'disk is full'
}

describe('settleBeforeDestructiveAction', () => {
    it('flushes before running the action', async () => {
        const events: string[] = []

        const result = await settleBeforeDestructiveAction({
            flush: async () => {
                events.push('flush')
                return { ok: true }
            },
            onFailure: () => {
                events.push('failure')
                return 'continue'
            },
            action: (flushOk) => {
                events.push(`action:${flushOk}`)
            }
        })

        expect(result).toBe('completed')
        expect(events).toEqual(['flush', 'action:true'])
    })

    it('does not run the action when the user cancels after a failed save', async () => {
        const events: string[] = []

        const result = await settleBeforeDestructiveAction({
            flush: async () => failure,
            onFailure: () => 'cancel',
            action: () => {
                events.push('action')
            }
        })

        expect(result).toBe('cancelled')
        expect(events).toEqual([])
    })

    it('runs the action but reports an unsafe flush when the user continues', async () => {
        const events: string[] = []

        const result = await settleBeforeDestructiveAction({
            flush: async () => failure,
            onFailure: () => 'continue',
            action: (flushOk) => {
                events.push(`action:${flushOk}`)
            }
        })

        expect(result).toBe('completed')
        expect(events).toEqual(['action:false'])
    })

    it('treats an unexpected flush exception as a failed save', async () => {
        const seen: FlushFailure[] = []

        const result = await settleBeforeDestructiveAction({
            flush: async () => {
                throw new Error('renderer crashed')
            },
            onFailure: (caught) => {
                seen.push(caught)
                return 'cancel'
            },
            action: () => {
                throw new Error('should not run')
            }
        })

        expect(result).toBe('cancelled')
        expect(seen).toHaveLength(1)
        expect(seen[0]).toMatchObject({ ok: false, reason: 'error', message: 'renderer crashed' })
    })

    it('cancels safely if the failure prompt itself throws', async () => {
        const result = await settleBeforeDestructiveAction({
            flush: async () => failure,
            onFailure: () => {
                throw new Error('dialog failed')
            },
            action: () => {
                throw new Error('should not run')
            }
        })

        expect(result).toBe('cancelled')
    })
})

describe('quit flow with real notes', () => {
    let directory: string
    let store: NotesStore

    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'indigo-quit-'))
        store = new NotesStore(directory)
        await store.init()
    })

    afterEach(async () => {
        await rm(directory, { recursive: true, force: true })
    })

    async function runQuit(flush: () => Promise<FlushResult>): Promise<void> {
        await settleBeforeDestructiveAction({
            flush,
            onFailure: () => 'cancel',
            action: async (flushOk) => {
                if (flushOk) await store.pruneDrafts()
            }
        })
    }

    it('saves a new note typed immediately before quit, then prunes', async () => {
        const note = await store.createNote()
        expect(note.isDraft).toBe(true)

        await runQuit(async () => {
            await store.updateNote({
                id: note.id,
                title: 'Typed at the last moment',
                body: TEXT_BODY
            })
            return { ok: true }
        })

        const saved = await store.getNote(note.id)
        expect(saved).not.toBeNull()
        expect(saved?.title).toBe('Typed at the last moment')
        expect(saved?.isDraft).toBe(false)
    })

    it('saves the latest edit to an existing note before quit', async () => {
        const note = await store.createNote()
        await store.updateNote({
            id: note.id,
            title: 'First draft',
            body: TEXT_BODY
        })

        await runQuit(async () => {
            await store.updateNote({
                id: note.id,
                title: 'Final wording',
                body: TEXT_BODY
            })
            return { ok: true }
        })

        const saved = await store.getNote(note.id)
        expect(saved?.title).toBe('Final wording')
    })

    it('leaves a draft on disk when the flush fails and quitting is cancelled', async () => {
        const note = await store.createNote()

        await runQuit(async () => failure)

        expect(await store.getNote(note.id)).not.toBeNull()
    })
})
