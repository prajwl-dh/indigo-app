/**
 * Electron wraps IPC failures in a long "Error invoking remote method" prefix.
 * Keep the sentence the main process actually wrote.
 */
export function messageFromError(error: unknown, fallback = 'Something went wrong.'): string {
    if (!(error instanceof Error)) {
        const text = typeof error === 'string' ? error.trim() : ''
        return text || fallback
    }

    const message = error.message.trim()
    if (!message) return fallback

    const marker = message.lastIndexOf('Error: ')
    if (marker >= 0) {
        const tail = message.slice(marker + 'Error: '.length).trim()
        if (tail) return tail
    }

    return message
}
