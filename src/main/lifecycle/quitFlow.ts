import type { FlushFailure, FlushResult } from './flush'

export type FailureDecision = 'continue' | 'cancel'
export type SettleResult = 'completed' | 'cancelled'

type SettleOptions = {
    flush: () => Promise<FlushResult>
    onFailure: (failure: FlushFailure) => FailureDecision | Promise<FailureDecision>
    action: (flushOk: boolean) => void | Promise<void>
    log?: (message: string, error?: unknown) => void
}

function failureFrom(error: unknown): FlushFailure {
    return {
        ok: false,
        reason: 'error',
        message: error instanceof Error ? error.message : String(error)
    }
}

/**
 * Run a destructive lifecycle action only after the renderer has had a chance
 * to flush. If flushing fails, ask the user. Cancelling leaves the app/window
 * open; continuing runs the action but tells it whether pruning is safe.
 */
export async function settleBeforeDestructiveAction({
    flush,
    onFailure,
    action,
    log
}: SettleOptions): Promise<SettleResult> {
    let result: FlushResult
    try {
        result = await flush()
    } catch (error) {
        log?.('flush failed unexpectedly', error)
        result = failureFrom(error)
    }

    if (!result.ok) {
        let decision: FailureDecision
        try {
            decision = await onFailure(result)
        } catch (error) {
            log?.('could not ask what to do after a failed save', error)
            return 'cancelled'
        }
        if (decision === 'cancel') return 'cancelled'
    }

    await action(result.ok)
    return 'completed'
}
