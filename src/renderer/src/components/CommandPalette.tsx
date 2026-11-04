import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { CornerDownLeft, FileText, Plus, Search, Settings } from 'lucide-react'
import { useMemo, useState, type JSX, type KeyboardEvent } from 'react'
import type { Note } from '../../../shared/model/note'
import { noteMatchesSearch, parseSearch } from '../../../shared/util/noteSearch'
import { formatRelativeTime, noteExcerpt, noteTitle } from '../lib/format'
import { useWorkspace } from '../state/workspace'

type CommandPaletteProps = {
    open: boolean
    onClose: () => void
}

type PaletteAction = {
    id: string
    label: string
    description: string
    icon: JSX.Element
    run: () => void
}

type PaletteRow = { kind: 'action'; action: PaletteAction } | { kind: 'note'; note: Note }

const MAX_NOTES = 8

export default function CommandPalette({ open, onClose }: CommandPaletteProps): JSX.Element {
    const { notes, openNote, createNote, openSettings } = useWorkspace()
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)

    const actions = useMemo<PaletteAction[]>(
        () => [
            {
                id: 'new-note',
                label: 'New note',
                description: 'Start a fresh page',
                icon: <Plus size={15} />,
                run: () => void createNote()
            },
            {
                id: 'settings',
                label: 'Open settings',
                description: 'Theme, storage, and updates',
                icon: <Settings size={15} />,
                run: () => openSettings()
            }
        ],
        [createNote, openSettings]
    )

    const matchingNotes = useMemo(() => {
        const parsed = parseSearch(query)
        const pool = notes.filter((note) => !note.isInTrash)
        const matches =
            parsed.conditions.length > 0
                ? pool.filter((note) => noteMatchesSearch(note, parsed))
                : pool

        return [...matches]
            .sort((a, b) => {
                const aTitle = a.title.trim().toLowerCase()
                const bTitle = b.title.trim().toLowerCase()
                const needle = query.trim().toLowerCase()
                if (needle) {
                    const aStarts = aTitle.startsWith(needle)
                    const bStarts = bTitle.startsWith(needle)
                    if (aStarts !== bStarts) return aStarts ? -1 : 1
                }
                return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
            })
            .slice(0, MAX_NOTES)
    }, [notes, query])

    const rows = useMemo<PaletteRow[]>(
        () => [
            ...actions.map((action) => ({ kind: 'action' as const, action })),
            ...matchingNotes.map((note) => ({ kind: 'note' as const, note }))
        ],
        [actions, matchingNotes]
    )

    const cursor = rows.length === 0 ? 0 : Math.min(activeIndex, rows.length - 1)
    const activeRow = rows[cursor]

    const choose = (row: PaletteRow | undefined): void => {
        if (!row) return
        onClose()
        if (row.kind === 'action') {
            row.action.run()
            return
        }
        void openNote(row.note.id)
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (rows.length === 0) return
            setActiveIndex((current) => (current + 1) % rows.length)
            return
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (rows.length === 0) return
            setActiveIndex((current) => (current - 1 + rows.length) % rows.length)
            return
        }

        if (event.key === 'Enter') {
            event.preventDefault()
            choose(activeRow)
        }
    }

    return (
        <Dialog open={open} onClose={onClose} className="dialog palette-dialog">
            <DialogBackdrop transition className="dialog-backdrop palette-backdrop" />
            <div className="palette-viewport">
                <DialogPanel transition className="palette-panel">
                    <DialogTitle className="palette-heading">Quick switcher</DialogTitle>
                    <div className="palette-input-row">
                        <Search size={16} className="palette-search-icon" aria-hidden="true" />
                        <input
                            className="palette-input"
                            type="text"
                            value={query}
                            placeholder="Find a note or run a command"
                            aria-label="Find a note or run a command"
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
                        className="palette-list"
                        role="listbox"
                        aria-label="Quick switcher results"
                    >
                        {rows.length === 0 ? (
                            <p className="palette-empty">No notes match that search.</p>
                        ) : (
                            rows.map((row, index) => {
                                const active = index === cursor
                                const key =
                                    row.kind === 'action'
                                        ? `action:${row.action.id}`
                                        : `note:${row.note.id}`

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        role="option"
                                        aria-selected={active}
                                        className="palette-row"
                                        data-active={active ? 'true' : 'false'}
                                        onMouseMove={() => setActiveIndex(index)}
                                        onClick={() => choose(row)}
                                    >
                                        <span className="palette-row-icon" aria-hidden="true">
                                            {row.kind === 'action' ? (
                                                row.action.icon
                                            ) : (
                                                <FileText size={15} />
                                            )}
                                        </span>
                                        <span className="palette-row-text">
                                            <span className="palette-row-title">
                                                {row.kind === 'action'
                                                    ? row.action.label
                                                    : noteTitle(row.note)}
                                            </span>
                                            <span className="palette-row-description">
                                                {row.kind === 'action'
                                                    ? row.action.description
                                                    : noteExcerpt(row.note, 90) || 'No text yet'}
                                            </span>
                                        </span>
                                        <span className="palette-row-meta">
                                            {row.kind === 'note'
                                                ? formatRelativeTime(row.note.lastModified)
                                                : ''}
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
                            <kbd className="palette-key">↵</kbd> to open
                        </span>
                    </p>
                </DialogPanel>
            </div>
        </Dialog>
    )
}
