import type { Note } from '../../../shared/model/note'
import { extractPlainText } from '../../../shared/util/noteText'

const day = 24 * 60 * 60 * 1000

function startOfDay(value: Date): number {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

export function formatRelativeTime(iso: string, now = new Date()): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''

    const diff = now.getTime() - date.getTime()
    if (diff < 45_000) return 'Just now'

    const minutes = Math.floor(diff / 60_000)
    if (minutes < 60) return `${minutes}m ago`

    const today = startOfDay(now)
    const thatDay = startOfDay(date)
    const days = Math.round((today - thatDay) / day)

    if (days === 0) {
        return new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit'
        }).format(date)
    }

    if (days === 1) return 'Yesterday'
    if (days > 1 && days < 7) {
        return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date)
    }

    const sameYear = date.getFullYear() === now.getFullYear()
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' })
    }).format(date)
}

export function formatExactTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(date)
}

export function noteExcerpt(note: Note, length = 150): string {
    const text = extractPlainText(note.body)
    if (!text) return ''
    if (text.length <= length) return text

    const clipped = text.slice(0, length)
    const lastSpace = clipped.lastIndexOf(' ')
    return `${(lastSpace > length * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`
}

export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : plural}`
}

export function noteTitle(note: Pick<Note, 'title'>): string {
    const title = note.title.trim()
    return title || 'Untitled note'
}
