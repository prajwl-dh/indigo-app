import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react'
import { ArrowLeft, Clipboard, Copy, MoreHorizontal, RotateCcw, Star, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import TextareaAutosize from 'react-textarea-autosize'
import type { Note } from '../../../../shared/model/note'
import { getNoteColor, type NoteColor } from '../../../../shared/model/noteColor'
import {
    countWords,
    extractPlainText,
    isBlockDocumentEmpty,
    titleFromBody
} from '../../../../shared/util/noteText'
import { countLabel, formatExactTime, formatRelativeTime, noteTitle } from '../../lib/format'
import { useAppearance } from '../../state/appearance'
import { useToast } from '../../state/toast'
import { useWorkspace } from '../../state/workspace'
import { useTitleBarSlots } from '../titleBarSlotContext'
import BlockEditor, { type BlockEditorHandle } from './BlockEditor'
import NoteColorMenu from './NoteColorMenu'
import ConfirmDialog from '../ConfirmDialog'
import TagPicker from './TagPicker'

type NoteEditorProps = {
    note: Note
    isCompact: boolean
    onBack: () => void
}

type SaveState = 'saved' | 'saving' | 'error'

export default function NoteEditor({ note, isCompact, onBack }: NoteEditorProps): JSX.Element {
    const { resolved } = useAppearance()
    const { pushError } = useToast()
    const {
        tags: allTags,
        updateNote,
        previewNote,
        setSaveHandler,
        createTag,
        toggleFavorite,
        duplicateNote,
        copyNoteText,
        moveToTrash,
        restoreNote,
        deleteNote
    } = useWorkspace()

    const [title, setTitle] = useState(note.title)
    const [wordCount, setWordCount] = useState(() => countWords(extractPlainText(note.body)))
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [confirmDelete, setConfirmDelete] = useState(false)
    const { actions: actionsSlot, back: backSlot } = useTitleBarSlots()

    const titleInput = useRef<HTMLTextAreaElement>(null)
    const blockEditor = useRef<BlockEditorHandle>(null)

    const titleValue = useRef(note.title)
    const bodyValue = useRef(note.body)
    const dirtyRef = useRef(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const aliveRef = useRef(true)
    const notifiedRef = useRef(false)
    const chainRef = useRef<Promise<void>>(Promise.resolve())

    const persist = useCallback(async (): Promise<void> => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }

        if (!dirtyRef.current) {
            await chainRef.current
            return
        }

        dirtyRef.current = false
        const id = note.id
        const body = bodyValue.current
        let title = titleValue.current.trim()

        // A note needs a title to exist. If the writer only wrote a body, the
        // opening words become the title; if there is nothing at all, skip the
        // write and let the blank draft be discarded when it is left.
        if (!title) {
            if (isBlockDocumentEmpty(body)) {
                if (aliveRef.current) setSaveState('saved')
                return
            }

            title = titleFromBody(body)
            titleValue.current = title
            if (aliveRef.current) {
                setTitle(title)
                previewNote(id, { title })
            }
        } else if (title !== titleValue.current) {
            titleValue.current = title
            if (aliveRef.current) setTitle(title)
        }

        const payload = {
            id,
            title,
            body
        }

        if (aliveRef.current) setSaveState('saving')

        const run = async (): Promise<void> => {
            try {
                await updateNote(payload)
                if (!aliveRef.current) return
                previewNote(id, { title: titleValue.current, body: bodyValue.current })
                notifiedRef.current = false
                if (!dirtyRef.current) setSaveState('saved')
            } catch (error) {
                if (!aliveRef.current) return
                dirtyRef.current = true
                setSaveState('error')
                if (!notifiedRef.current) {
                    notifiedRef.current = true
                    pushError(error, 'Could not save this note.')
                }
            }
        }

        chainRef.current = chainRef.current.then(run, run)
        await chainRef.current
    }, [note.id, previewNote, pushError, updateNote])

    const persistRef = useRef(persist)

    useEffect(() => {
        persistRef.current = persist
    }, [persist])

    const schedule = useCallback((): void => {
        dirtyRef.current = true
        notifiedRef.current = false
        setSaveState('saving')

        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            timerRef.current = null
            void persistRef.current()
        }, 500)
    }, [])

    const flush = useCallback(async (): Promise<void> => {
        await persistRef.current()
    }, [])

    const flushRef = useRef(flush)

    useEffect(() => {
        flushRef.current = flush
    }, [flush])

    useEffect(() => {
        setSaveHandler(() => flushRef.current())
        return () => setSaveHandler(null)
    }, [setSaveHandler])

    useEffect(() => {
        aliveRef.current = true
        return () => {
            aliveRef.current = false
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
            void persistRef.current()
        }
    }, [])

    useEffect(() => {
        const onBlur = (): void => {
            void flushRef.current()
        }
        const onVisibility = (): void => {
            if (document.visibilityState === 'hidden') void flushRef.current()
        }

        window.addEventListener('blur', onBlur)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            window.removeEventListener('blur', onBlur)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [])

    useEffect(() => {
        if (note.isInTrash) return
        if (note.title !== '' || !isBlockDocumentEmpty(note.body)) return
        window.requestAnimationFrame(() => titleInput.current?.focus())
    }, [note.body, note.isInTrash, note.title])

    const changeTitle = (next: string): void => {
        if (next === titleValue.current) return
        titleValue.current = next
        setTitle(next)
        previewNote(note.id, { title: next })
        schedule()
    }

    const changeBody = (next: string): void => {
        if (next === bodyValue.current) return
        bodyValue.current = next
        setWordCount(countWords(extractPlainText(next)))
        schedule()
    }

    const changeTags = async (nextTags: string[]): Promise<void> => {
        await updateNote({ id: note.id, tags: nextTags })
    }

    const changeColor = async (next: NoteColor | null): Promise<void> => {
        try {
            await updateNote({ id: note.id, color: next })
        } catch (caught) {
            pushError(caught, 'Could not change the note colour.')
        }
    }

    const colorValue = note.color ? getNoteColor(note.color)[resolved] : null

    const handleDelete = async (): Promise<void> => {
        await deleteNote(note.id)
    }

    const noteActions = (
        <div className="note-actions">
            {note.isInTrash ? (
                <span className="save-state" data-state="idle">
                    Read only
                </span>
            ) : saveState === 'error' ? (
                <button
                    type="button"
                    className="save-state save-state--error"
                    onClick={() => void flush()}
                    title="Try saving again"
                >
                    Save failed · Retry
                </button>
            ) : (
                <span className="save-state" data-state={saveState} aria-live="polite">
                    {saveState === 'saving' ? 'Saving…' : 'Saved'}
                </span>
            )}

            {!note.isInTrash && (
                <NoteColorMenu color={note.color} onChange={(next) => void changeColor(next)} />
            )}

            {!note.isInTrash && (
                <button
                    type="button"
                    className={`icon-button ${note.isFavorite ? 'is-active' : ''}`}
                    aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-pressed={note.isFavorite}
                    title={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    onClick={() => void toggleFavorite(note.id)}
                >
                    <Star size={16} fill={note.isFavorite ? 'currentColor' : 'none'} />
                </button>
            )}

            <Menu as="div" className="menu-root">
                <MenuButton
                    type="button"
                    className="icon-button"
                    aria-label="Note options"
                    title="Note options"
                >
                    <MoreHorizontal size={17} />
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
    )

    return (
        <section className="editor-pane" aria-label="Note editor">
            {actionsSlot && createPortal(noteActions, actionsSlot)}
            {isCompact &&
                backSlot &&
                createPortal(
                    <button
                        type="button"
                        className="icon-button"
                        aria-label="Back to notes"
                        title="Back to notes"
                        onClick={onBack}
                    >
                        <ArrowLeft size={17} />
                    </button>,
                    backSlot
                )}

            <div className="editor-scroll">
                <div className="editor-page">
                    {note.isInTrash && (
                        <div className="trash-notice" role="status">
                            <Trash2 className="trash-notice-icon" size={14} aria-hidden="true" />
                            <p>This note is in the trash.</p>
                            <button
                                type="button"
                                className="trash-notice-action"
                                onClick={() => void restoreNote(note.id)}
                            >
                                Restore
                            </button>
                        </div>
                    )}

                    {colorValue && (
                        <span
                            className="note-color-flag"
                            style={{ '--note-color': colorValue } as CSSProperties}
                            title={`Note colour: ${note.color ? getNoteColor(note.color).label : ''}`}
                        />
                    )}

                    <TextareaAutosize
                        ref={titleInput}
                        className="note-title"
                        value={title}
                        readOnly={note.isInTrash}
                        placeholder="Title"
                        aria-label="Note title"
                        aria-required="true"
                        required
                        minRows={1}
                        maxRows={4}
                        spellCheck
                        onChange={(event) => changeTitle(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter') return
                            event.preventDefault()
                            blockEditor.current?.focus()
                        }}
                    />

                    <div className="note-meta">
                        <span title={formatExactTime(note.lastModified)}>
                            Edited {formatRelativeTime(note.lastModified)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{countLabel(wordCount, 'word')}</span>
                    </div>

                    {(!note.isInTrash || note.tags.length > 0) && (
                        <TagPicker
                            tags={note.tags}
                            allTags={allTags}
                            disabled={note.isInTrash}
                            onChange={changeTags}
                            onCreateTag={createTag}
                        />
                    )}

                    <div className="note-body">
                        <BlockEditor
                            ref={blockEditor}
                            noteId={note.id}
                            initialBody={note.body}
                            editable={!note.isInTrash}
                            theme={resolved}
                            onChange={changeBody}
                        />
                    </div>
                </div>
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
                onConfirm={handleDelete}
            />
        </section>
    )
}
