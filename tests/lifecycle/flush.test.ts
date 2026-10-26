import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushRenderer, type FlushChannel } from '../../src/main/lifecycle/flush'

type TestChannel = {
    channel: FlushChannel
    sent: string[]
    reply: (requestId: string, error?: string | null) => void
    isUnsubscribed: () => boolean
}

function testChannel(onSend?: (requestId: string) => void): TestChannel {
    let listener: ((requestId: string, error: string | null) => void) | null = null
    let unsubscribed = false
    const sent: string[] = []

    return {
        channel: {
            send: (requestId) => {
                sent.push(requestId)
                onSend?.(requestId)
            },
            subscribe: (next) => {
                listener = next
                return () => {
                    unsubscribed = true
                    listener = null
                }
            }
        },
        sent,
        reply: (requestId, error = null) => {
            listener?.(requestId, error)
        },
        isUnsubscribed: () => unsubscribed
    }
}

afterEach(() => {
    vi.useRealTimers()
})

describe('flushRenderer', () => {
    it('waits for the renderer acknowledgement', async () => {
        const test = testChannel()
        const pending = flushRenderer(test.channel, {
            timeoutMs: 1_000,
            requestId: () => 'request-1'
        })

        expect(test.sent).toEqual(['request-1'])
        test.reply('request-1')

        await expect(pending).resolves.toEqual({ ok: true })
        expect(test.isUnsubscribed()).toBe(true)
    })

    it('reports a save failure from the renderer', async () => {
        const test = testChannel()
        const pending = flushRenderer(test.channel, {
            timeoutMs: 1_000,
            requestId: () => 'request-2'
        })

        test.reply('request-2', 'disk is full')

        await expect(pending).resolves.toEqual({
            ok: false,
            reason: 'error',
            message: 'disk is full'
        })
    })

    it('ignores acknowledgements for another request', async () => {
        const test = testChannel()
        const pending = flushRenderer(test.channel, {
            timeoutMs: 1_000,
            requestId: () => 'request-3'
        })

        test.reply('request-other')
        test.reply('request-3')

        await expect(pending).resolves.toEqual({ ok: true })
    })

    it('times out when the renderer never answers', async () => {
        vi.useFakeTimers()
        const test = testChannel()
        const pending = flushRenderer(test.channel, {
            timeoutMs: 50,
            requestId: () => 'request-4'
        })

        await vi.advanceTimersByTimeAsync(50)

        await expect(pending).resolves.toMatchObject({
            ok: false,
            reason: 'timeout'
        })
        expect(test.isUnsubscribed()).toBe(true)
    })

    it('reports a synchronous send failure without hanging', async () => {
        const test = testChannel(() => {
            throw new Error('window is gone')
        })
        const pending = flushRenderer(test.channel, {
            timeoutMs: 1_000,
            requestId: () => 'request-5'
        })

        await expect(pending).resolves.toEqual({
            ok: false,
            reason: 'error',
            message: 'window is gone'
        })
    })
})
