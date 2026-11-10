import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { CornerDownLeft, FileText, Link2 } from 'lucide-react'
import { useMemo, useState, type JSX, type KeyboardEvent } from 'react'
import type { Note } from '../../../../shared/model/note'
import { extractPlainText } from '../../../../shared/util/noteText'
import { formatRelativeTime, noteExcerpt, noteTitle } from '../../lib/format'
import { useWorkspace } from '../../state/workspace'

type NoteLinkDialogProps = {
    open: boolean
    /** The note being edited, which cannot link to itself. */
    excludeNoteId: string
    onClose: () => void
    onPick: (note: Note) => void
}

const MAX_RESULTS = 40

export default function NoteLinkDialog({
    open,
    excludeNoteId,
    onClose,
    onPick
}: NoteLinkDialogProps): JSX.Element {
    const { notes } = useWorkspace()
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)

    const close = (): void => {
        setQuery('')
        setActiveIndex(0)
        onClose()
    }

    const matches = useMemo(() => {
        const needle = query.trim().toLowerCase()
        const pool = notes
            .filter((note) => !note.isInTrash && note.id !== excludeNoteId)
            .filter((note) => {
                if (!needle) return true
                if (noteTitle(note).toLowerCase().includes(needle)) return true
                return extractPlainText(note.body).toLowerCase().includes(needle)
            })

        return [...pool]
            .sort((a, b) => {
                if (needle) {
                    const aTitle = noteTitle(a).toLowerCase()
                    const bTitle = noteTitle(b).toLowerCase()
                    const aStarts = aTitle.startsWith(needle)
                    const bStarts = bTitle.startsWith(needle)
                    if (aStarts !== bStarts) return aStarts ? -1 : 1
                }
                return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
            })
            .slice(0, MAX_RESULTS)
    }, [excludeNoteId, notes, query])

    const cursor = matches.length === 0 ? 0 : Math.min(activeIndex, matches.length - 1)
    const activeNote = matches[cursor]

    const choose = (note: Note | undefined): void => {
        if (!note) return
        onPick(note)
        close()
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (matches.length === 0) return
            setActiveIndex((current) => (current + 1) % matches.length)
            return
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (matches.length === 0) return
            setActiveIndex((current) => (current - 1 + matches.length) % matches.length)
            return
        }

        if (event.key === 'Enter') {
            event.preventDefault()
            choose(activeNote)
        }
    }

    return (
        <Dialog open={open} onClose={close} className="dialog palette-dialog note-link-dialog">
            <DialogBackdrop transition className="dialog-backdrop palette-backdrop" />
            <div className="palette-viewport">
                <DialogPanel transition className="palette-panel note-link-panel">
                    <DialogTitle className="palette-heading">Link to note</DialogTitle>
                    <div className="palette-input-row">
                        <Link2 size={16} className="palette-search-icon" aria-hidden="true" />
                        <input
                            className="palette-input"
                            type="text"
                            value={query}
                            placeholder="Find a note to link"
                            aria-label="Find a note to link"
                            autoComplete="off"
                            spellCheck={false}
                            autoFocus
                            onChange={(event) => {
                                setQuery(event.target.value)
                                setActiveIndex(0)
                            }}
                            onKeyDown={handleKeyDown}
                        />
                        <kbd className="palette-key" aria-hidden="true">
                            Esc
                        </kbd>
                    </div>

                    <div
                        className="palette-list note-link-list"
                        role="listbox"
                        aria-label="Notes to link"
                    >
                        {matches.length === 0 ? (
                            <p className="palette-empty">
                                {query.trim()
                                    ? 'No notes match that search.'
                                    : 'There are no other notes to link yet.'}
                            </p>
                        ) : (
                            matches.map((note, index) => {
                                const active = index === cursor
                                return (
                                    <button
                                        key={note.id}
                                        type="button"
                                        role="option"
                                        aria-selected={active}
                                        className="palette-row"
                                        data-active={active ? 'true' : 'false'}
                                        onMouseMove={() => setActiveIndex(index)}
                                        onClick={() => choose(note)}
                                    >
                                        <span className="palette-row-icon" aria-hidden="true">
                                            <FileText size={15} />
                                        </span>
                                        <span className="palette-row-text">
                                            <span className="palette-row-title">
                                                {noteTitle(note)}
                                            </span>
                                            <span className="palette-row-description">
                                                {noteExcerpt(note, 90) || 'No text yet'}
                                            </span>
                                        </span>
                                        <span className="palette-row-meta">
                                            {formatRelativeTime(note.lastModified)}
                                        </span>
                                        {active && (
                                            <CornerDownLeft
                                                size={13}
                                                className="palette-row-enter"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </button>
                                )
                            })
                        )}
                    </div>

                    <p className="palette-foot">
                        <span>
                            <kbd className="palette-key">↑</kbd>
                            <kbd className="palette-key">↓</kbd> to move
                        </span>
                        <span>
                            <kbd className="palette-key">↵</kbd> to link
                        </span>
                    </p>
                </DialogPanel>
            </div>
        </Dialog>
    )
}
