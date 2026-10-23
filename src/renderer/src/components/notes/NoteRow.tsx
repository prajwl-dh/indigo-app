import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react'
import { Clipboard, Copy, MoreHorizontal, RotateCcw, Star, Trash2 } from 'lucide-react'
import { useState, type CSSProperties, type JSX, type KeyboardEvent } from 'react'
import type { Note } from '../../../../shared/model/note'
import { getNoteColor } from '../../../../shared/model/noteColor'
import ConfirmDialog from '../ConfirmDialog'
import { formatRelativeTime, noteExcerpt, noteTitle } from '../../lib/format'
import { useAppearance } from '../../state/appearance'
import { useWorkspace } from '../../state/workspace'

type NoteRowProps = {
    note: Note
    isActive: boolean
    onOpen: () => void
}

export default function NoteRow({ note, isActive, onOpen }: NoteRowProps): JSX.Element {
    const { toggleFavorite, duplicateNote, copyNoteText, moveToTrash, restoreNote, deleteNote } =
        useWorkspace()
    const { resolved } = useAppearance()
    const [confirmDelete, setConfirmDelete] = useState(false)

    const excerpt = noteExcerpt(note)
    const color = note.color ? getNoteColor(note.color)[resolved] : null

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.target !== event.currentTarget) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen()
    }

    return (
        <>
            <div
                className="note-row"
                role="option"
                aria-selected={isActive}
                data-active={isActive}
                data-colored={color ? 'true' : 'false'}
                style={color ? ({ '--note-color': color } as CSSProperties) : undefined}
                tabIndex={0}
                onClick={onOpen}
                onKeyDown={handleKeyDown}
            >
                <div className="note-row-body">
                    <div className="note-row-header">
                        <span className="note-row-title">{noteTitle(note)}</span>
                        {note.isFavorite && (
                            <Star
                                className="note-row-star"
                                size={12}
                                fill="currentColor"
                                aria-label="Favorite"
                            />
                        )}
                    </div>

                    <p className="note-row-excerpt">{excerpt || 'No text yet'}</p>

                    <div className="note-row-meta">
                        <time dateTime={note.lastModified}>
                            {formatRelativeTime(note.lastModified)}
                        </time>
                        {note.tags.slice(0, 2).map((tag) => (
                            <span className="tag-pill" key={tag}>
                                {tag}
                            </span>
                        ))}
                        {note.tags.length > 2 && (
                            <span className="note-row-more">+{note.tags.length - 2}</span>
                        )}
                    </div>
                </div>

                <Menu as="div" className="menu-root note-row-menu">
                    <MenuButton
                        type="button"
                        className="icon-button icon-button--small note-row-menu-button"
                        aria-label={`Options for ${noteTitle(note)}`}
                        title="Note options"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <MoreHorizontal size={15} />
                    </MenuButton>
                    <MenuItems anchor="bottom end" portal transition className="menu-panel">
                        {note.isInTrash ? (
                            <>
                                <MenuItem
                                    as="button"
                                    className="menu-item"
                                    onClick={() => void restoreNote(note.id)}
                                >
                                    <RotateCcw size={14} />
                                    Restore note
                                </MenuItem>
                                <MenuItem
                                    as="button"
                                    className="menu-item menu-item--danger"
                                    onClick={() => setConfirmDelete(true)}
                                >
                                    <Trash2 size={14} />
                                    Delete permanently
                                </MenuItem>
                            </>
                        ) : (
                            <>
                                <MenuItem
                                    as="button"
                                    className="menu-item"
                                    onClick={() => void toggleFavorite(note.id)}
                                >
                                    <Star size={14} />
                                    {note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                </MenuItem>
                                <MenuItem
                                    as="button"
                                    className="menu-item"
                                    onClick={() => void duplicateNote(note.id)}
                                >
                                    <Copy size={14} />
                                    Duplicate note
                                </MenuItem>
                                <MenuItem
                                    as="button"
                                    className="menu-item"
                                    onClick={() => void copyNoteText(note.id)}
                                >
                                    <Clipboard size={14} />
                                    Copy as text
                                </MenuItem>
                                <MenuSeparator className="menu-separator" />
                                <MenuItem
                                    as="button"
                                    className="menu-item menu-item--danger"
                                    onClick={() => void moveToTrash(note.id)}
                                >
                                    <Trash2 size={14} />
                                    Move to trash
                                </MenuItem>
                            </>
                        )}
                    </MenuItems>
                </Menu>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                title="Delete this note?"
                description={
                    <>
                        <strong>{noteTitle(note)}</strong> will be removed from this computer. This
                        cannot be undone.
                    </>
                }
                confirmLabel="Delete permanently"
                tone="danger"
                onClose={() => setConfirmDelete(false)}
                onConfirm={async () => {
                    await deleteNote(note.id)
                }}
            />
        </>
    )
}
