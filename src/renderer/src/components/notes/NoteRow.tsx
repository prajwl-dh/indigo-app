import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react'
import {
    Check,
    Clipboard,
    Copy,
    Download,
    MoreHorizontal,
    Pin,
    RotateCcw,
    Star,
    Trash2
} from 'lucide-react'
import { useState, type CSSProperties, type JSX, type KeyboardEvent, type MouseEvent } from 'react'
import type { Note, NoteTransferFormat } from '../../../../shared/model/note'
import { getNoteColor } from '../../../../shared/model/noteColor'
import ConfirmDialog from '../ConfirmDialog'
import TransferDialog from '../TransferDialog'
import { formatRelativeTime, noteExcerpt, noteTitle } from '../../lib/format'
import { useAppearance } from '../../state/appearance'
import { useWorkspace } from '../../state/workspace'

type NoteRowProps = {
    note: Note
    isActive: boolean
    onOpen: () => void
    selectionMode?: boolean
    selected?: boolean
    onToggleSelect?: (shiftKey?: boolean) => void
}

export default function NoteRow({
    note,
    isActive,
    onOpen,
    selectionMode = false,
    selected = false,
    onToggleSelect
}: NoteRowProps): JSX.Element {
    const {
        toggleFavorite,
        togglePinned,
        duplicateNote,
        copyNote,
        exportNote,
        moveToTrash,
        restoreNote,
        deleteNote
    } = useWorkspace()
    const { resolved } = useAppearance()
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [transfer, setTransfer] = useState<'copy' | 'export' | null>(null)

    const excerpt = noteExcerpt(note)
    const color = note.color ? getNoteColor(note.color)[resolved] : null

    const activate = (shiftKey = false): void => {
        if (selectionMode) {
            onToggleSelect?.(shiftKey)
            return
        }
        onOpen()
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.target !== event.currentTarget) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        activate(event.shiftKey)
    }

    const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
        // A plain click in selection mode checks the row; shift keeps the
        // range gesture familiar from file lists.
        if (selectionMode) {
            event.preventDefault()
            activate(event.shiftKey)
            return
        }
        activate()
    }

    const chooseTransfer = async (format: NoteTransferFormat): Promise<void> => {
        if (transfer === 'copy') {
            await copyNote(note.id, format)
            return
        }
        await exportNote(note.id, format)
    }

    return (
        <>
            <div
                className="note-row"
                role="option"
                aria-selected={selectionMode ? selected : isActive}
                data-active={isActive}
                data-selected={selected ? 'true' : 'false'}
                data-selection={selectionMode ? 'true' : 'false'}
                data-colored={color ? 'true' : 'false'}
                style={color ? ({ '--note-color': color } as CSSProperties) : undefined}
                tabIndex={0}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
            >
                {selectionMode && (
                    <span
                        className="note-select-box"
                        data-checked={selected ? 'true' : 'false'}
                        aria-hidden="true"
                    >
                        {selected && <Check size={11} />}
                    </span>
                )}

                <div className="note-row-body">
                    <div className="note-row-header">
                        <span className="note-row-title">{noteTitle(note)}</span>
                        <span className="note-row-marks">
                            {note.isPinned && (
                                <Pin
                                    className="note-row-pin"
                                    size={11}
                                    fill="currentColor"
                                    aria-label="Pinned"
                                />
                            )}
                            {note.isFavorite && (
                                <Star
                                    className="note-row-star"
                                    size={12}
                                    fill="currentColor"
                                    aria-label="Favorite"
                                />
                            )}
                        </span>
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

                {!selectionMode && (
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
                                        {note.isFavorite
                                            ? 'Remove from favorites'
                                            : 'Add to favorites'}
                                    </MenuItem>
                                    <MenuItem
                                        as="button"
                                        className="menu-item"
                                        onClick={() => void togglePinned(note.id)}
                                    >
                                        <Pin size={14} />
                                        {note.isPinned ? 'Unpin note' : 'Pin note'}
                                    </MenuItem>
                                    <MenuItem
                                        as="button"
                                        className="menu-item"
                                        onClick={() => void duplicateNote(note.id)}
                                    >
                                        <Copy size={14} />
                                        Duplicate note
                                    </MenuItem>
                                    <MenuSeparator className="menu-separator" />
                                    <MenuItem
                                        as="button"
                                        className="menu-item"
                                        onClick={() => setTransfer('copy')}
                                    >
                                        <Clipboard size={14} />
                                        Copy…
                                    </MenuItem>
                                    <MenuItem
                                        as="button"
                                        className="menu-item"
                                        onClick={() => setTransfer('export')}
                                    >
                                        <Download size={14} />
                                        Export…
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
                )}
            </div>

            <TransferDialog
                open={transfer !== null}
                mode={transfer ?? 'copy'}
                noteTitle={noteTitle(note)}
                onClose={() => setTransfer(null)}
                onChoose={chooseTransfer}
            />

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
