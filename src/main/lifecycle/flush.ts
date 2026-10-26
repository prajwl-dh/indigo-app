import { randomUUID } from 'node:crypto'

export type FlushFailure = {
    ok: false
    reason: 'timeout' | 'error'
    message: string
}

export type FlushResult = { ok: true } | FlushFailure

export type FlushChannel = {
    send: (requestId: string) => void
    subscribe: (listener: (requestId: string, error: string | null) => void) => () => void
}

type FlushOptions = {
    timeoutMs?: number
    requestId?: () => string
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

/**
 * Ask the renderer to finish any pending save and wait for its reply. The
 * timeout is deliberately finite: a broken renderer must not make quitting
 * impossible. The caller decides whether to continue or cancel on failure.
 */
export function flushRenderer(
    channel: FlushChannel,
    options: FlushOptions = {}
): Promise<FlushResult> {
    const timeoutMs = Math.max(1, options.timeoutMs ?? 2_000)
    const requestId = (options.requestId ?? randomUUID)()

    return new Promise((resolve) => {
        let settled = false
        let timer: ReturnType<typeof setTimeout> | null = null
        let unsubscribe = (): void => undefined

        const finish = (result: FlushResult): void => {
            if (settled) return
            settled = true
            if (timer) clearTimeout(timer)
            unsubscribe()
            resolve(result)
        }

        try {
            unsubscribe = channel.subscribe((id, error) => {
                if (id !== requestId) return
                if (error) {
                    finish({ ok: false, reason: 'error', message: error })
                    return
                }
                finish({ ok: true })
            })

            // A synchronous reply is unusual but must not leak the listener.
            if (settled) {
                unsubscribe()
                return
            }

            timer = setTimeout(() => {
                finish({
                    ok: false,
                    reason: 'timeout',
                    message: 'The editor did not finish saving in time.'
                })
            }, timeoutMs)

            channel.send(requestId)
        } catch (error) {
            finish({ ok: false, reason: 'error', message: errorMessage(error) })
        }
    })
}
