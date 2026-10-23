import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { ArrowUpDown, Check, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type JSX } from 'react'
import type { Note } from '../../../../shared/model/note'
import { countLabel } from '../../lib/format'
import { viewName } from '../../lib/labels'
import { useWorkspace } from '../../state/workspace'
import ConfirmDialog from '../ConfirmDialog'
import NoteRow from './NoteRow'

function inView(note: Note, view: 'all' | 'favorites' | 'trash'): boolean {
    if (view === 'trash') return note.isInTrash
    if (view === 'favorites') return !note.isInTrash && note.isFavorite
    return !note.isInTrash
}

export default function NotesPanel(): JSX.Element {
    const {
        notes,
        visibleNotes,
        loading,
        error,
        activeNote,
        view,
        activeTag,
        search,
        sort,
        setSort,
        setView,
        setSearch,
        setActiveTag,
        openNote,
        createNote,
        emptyTrash,
        refresh
    } = useWorkspace()
    const [confirmEmpty, setConfirmEmpty] = useState(false)

    const baseCount = useMemo(
        () =>
            notes.filter(
                (note) =>
                    inView(note, view) &&
                    (!activeTag ||
                        note.tags.some((tag) => tag.toLowerCase() === activeTag.toLowerCase()))
            ).length,
        [activeTag, notes, view]
    )

    const heading = activeTag ?? viewName(view)
    const query = search.trim()

    const subtitle =
        loading && notes.length === 0
            ? 'Reading your notes…'
            : query
              ? `${countLabel(visibleNotes.length, 'result')} for “${query}”`
              : activeTag
                ? `${countLabel(baseCount, 'note')} tagged`
                : view === 'favorites'
                  ? `${countLabel(baseCount, 'note')} starred`
                  : view === 'trash'
                    ? `${countLabel(baseCount, 'note')} in trash`
                    : countLabel(baseCount, 'note')

    const empty = ((): {
        title: string
        body: string
        action?: { label: string; run: () => void }
    } => {
        if (query) {
            return {
                title: `No matches for “${query}”`,
                body: 'Try another word, or clear the search to see everything again.',
                action: { label: 'Clear search', run: () => setSearch('') }
            }
        }

        if (activeTag) {
            return {
                title: `Nothing tagged “${activeTag}” yet`,
                body: 'Add this tag to a note, or clear the filter to see the rest of your library.',
                action: { label: 'Clear filter', run: () => void setActiveTag(null) }
            }
        }

        if (view === 'trash') {
            return {
                title: 'Trash is empty',
                body: 'Notes you move to the trash will wait here until you remove them.'
            }
        }

        if (view === 'favorites') {
            return {
                title: 'No favorites yet',
                body: 'Star the notes you want to keep close and they will collect here.',
                action: { label: 'Browse all notes', run: () => void setView('all') }
            }
        }

        return {
            title: 'No notes yet',
            body: 'A blank page is waiting. Everything you write is saved on this computer.',
            action: { label: 'Create your first note', run: () => void createNote() }
        }
    })()

    return (
        <aside className="notes-panel" aria-label="Notes">
            <header className="notes-head">
                <div className="notes-head-text">
                    <h1 className="notes-title">{heading}</h1>
                    <p className="notes-subtitle">{subtitle}</p>
                </div>

                <div className="notes-head-actions">
                    {view !== 'trash' && (
                        <button
                            type="button"
                            className="icon-button"
                            aria-label="New note"
                            title="New note"
                            onClick={() => void createNote()}
                        >
                            <Plus size={17} />
                        </button>
                    )}

                    <Menu as="div" className="menu-root">
                        <MenuButton
                            type="button"
                            className="sort-button"
                            aria-label={`Sort notes by ${sort === 'updated' ? 'last edited' : 'title'}`}
                            title="Sort notes"
                        >
                            <ArrowUpDown size={14} />
                            <span>{sort === 'updated' ? 'Updated' : 'Title'}</span>
                        </MenuButton>
                        <MenuItems
                            anchor="bottom end"
                            portal
                            transition
                            className="menu-panel menu-panel--small"
                        >
                            <MenuItem
                                as="button"
                                className="menu-item"
                                onClick={() => setSort('updated')}
                            >
                                <Check
                                    size={14}
                                    className={sort === 'updated' ? '' : 'invisible'}
                                />
                                Last edited
                            </MenuItem>
                            <MenuItem
                                as="button"
                                className="menu-item"
                                onClick={() => setSort('title')}
                            >
                                <Check size={14} className={sort === 'title' ? '' : 'invisible'} />
                                Title A–Z
                            </MenuItem>
                        </MenuItems>
                    </Menu>
                </div>
            </header>

            {error && (
                <div className="panel-error" role="alert">
                    <div>
                        <p className="panel-error-title">Couldn’t read your notes</p>
                        <p className="panel-error-body">{error}</p>
                    </div>
                    <button type="button" className="text-button" onClick={() => void refresh()}>
                        Retry
                    </button>
                </div>
            )}

            {loading && notes.length === 0 ? (
                <div className="notes-list" aria-busy="true" aria-label="Loading notes">
                    {[0, 1, 2, 3].map((row) => (
                        <div className="note-skeleton" key={row} aria-hidden="true">
                            <div className="skeleton-bar skeleton-bar--title" />
                            <div className="skeleton-bar skeleton-bar--line" />
                            <div className="skeleton-bar skeleton-bar--line skeleton-bar--short" />
                        </div>
                    ))}
                </div>
            ) : visibleNotes.length > 0 ? (
                <div className="notes-list" role="listbox" aria-label={heading}>
                    {visibleNotes.map((note) => (
                        <NoteRow
                            key={note.id}
                            note={note}
                            isActive={activeNote?.id === note.id}
                            onOpen={() => void openNote(note.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="list-empty" role="status">
                    <h2>{empty.title}</h2>
                    <p>{empty.body}</p>
                    {empty.action && (
                        <button
                            type="button"
                            className="button button--secondary button--small"
                            onClick={empty.action.run}
                        >
                            {empty.action.label}
                        </button>
                    )}
                </div>
            )}

            {view === 'trash' && baseCount > 0 && (
                <footer className="notes-foot">
                    <button
                        type="button"
                        className="trash-empty"
                        onClick={() => setConfirmEmpty(true)}
                    >
                        <Trash2 size={13} />
                        Empty trash
                    </button>
                </footer>
            )}

            <ConfirmDialog
                open={confirmEmpty}
                title="Empty the trash?"
                description={`${countLabel(baseCount, 'note')} will be deleted permanently. This cannot be undone.`}
                confirmLabel="Empty trash"
                tone="danger"
                onClose={() => setConfirmEmpty(false)}
                onConfirm={async () => {
                    await emptyTrash()
                }}
            />
        </aside>
    )
}
