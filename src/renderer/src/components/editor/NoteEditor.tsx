import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react'
import {
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Clipboard,
    Copy,
    Download,
    Focus,
    MoreHorizontal,
    Network,
    Pin,
    RotateCcw,
    Search,
    Star,
    Trash2,
    X
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import TextareaAutosize from 'react-textarea-autosize'
import type { Note, NoteTransferFormat } from '../../../../shared/model/note'
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
import NoteGraphDialog from './NoteGraphDialog'
import ConfirmDialog from '../ConfirmDialog'
import TransferDialog from '../TransferDialog'
import TagPicker from './TagPicker'

type NoteEditorProps = {
    note: Note
    isCompact: boolean
    onBack: () => void
    /** Kept mounted but out of view while a compact search covers the editor. */
    hidden?: boolean
    /** Opens focus mode: the editor alone, without the rest of the app. */
    onToggleFocus?: () => void
}

type SaveState = 'saved' | 'saving' | 'error'

// A crash can only lose the last fraction of a second of typing. The quit and
// window-close handshakes cover the rest; this keeps the unsaved window small.
const AUTOSAVE_DELAY_MS = 250

export default function NoteEditor({
    note,
    isCompact,
    onBack,
    hidden = false,
    onToggleFocus
}: NoteEditorProps): JSX.Element {
    const { resolved } = useAppearance()
    const { pushError } = useToast()
    const {
        tags: allTags,
        updateNote,
        previewNote,
        setSaveHandler,
        setTaskToggleHandler,
        revealTarget,
        clearReveal,
        createTag,
        toggleFavorite,
        togglePinned,
        duplicateNote,
        copyNote,
        exportNote,
        moveToTrash,
        restoreNote,
        deleteNote
    } = useWorkspace()

    const [title, setTitle] = useState(note.title)
    const [wordCount, setWordCount] = useState(() => countWords(extractPlainText(note.body)))
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [transfer, setTransfer] = useState<'copy' | 'export' | null>(null)
    const [graphOpen, setGraphOpen] = useState(false)
    const [findOpen, setFindOpen] = useState(false)
    const [findQuery, setFindQuery] = useState('')
    const [replaceValue, setReplaceValue] = useState('')
    const [findCase, setFindCase] = useState(false)
    const [findCount, setFindCount] = useState(0)
    const [findIndex, setFindIndex] = useState(0)
    const { actions: actionsSlot, back: backSlot } = useTitleBarSlots()

    const titleInput = useRef<HTMLTextAreaElement>(null)
    const blockEditor = useRef<BlockEditorHandle>(null)
    const findInput = useRef<HTMLInputElement>(null)

    const titleValue = useRef(note.title)
    const bodyValue = useRef(note.body)
    const dirtyRef = useRef(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const aliveRef = useRef(true)
    const notifiedRef = useRef(false)
    const chainRef = useRef<Promise<boolean>>(Promise.resolve(true))

    const persist = useCallback(
        async (deriveTitle = false): Promise<boolean> => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }

            if (!dirtyRef.current) {
                return chainRef.current
            }

            dirtyRef.current = false
            const id = note.id
            const body = bodyValue.current
            let title = titleValue.current.trim()

            // A note needs a title to exist. If the writer only wrote a body, the
            // opening words become the title — but only when the note is being
            // committed or the title field has been left. Refilling it on every
            // debounce would fight the writer mid-edit; and a slash menu that is
            // still open is choosing a block type, not writing a title.
            if (!title) {
                if (isBlockDocumentEmpty(body)) {
                    if (aliveRef.current) setSaveState('saved')
                    return true
                }

                const titleFocused = document.activeElement === titleInput.current
                const menuOpen = blockEditor.current?.isSuggestionMenuOpen() ?? false

                if (deriveTitle || (!titleFocused && !menuOpen)) {
                    title = titleFromBody(body)
                    titleValue.current = title
                    if (aliveRef.current) {
                        setTitle(title)
                        previewNote(id, { title })
                    }
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

            const run = async (): Promise<boolean> => {
                try {
                    await updateNote(payload)
                    if (aliveRef.current) {
                        previewNote(id, { title: titleValue.current, body: bodyValue.current })
                        notifiedRef.current = false
                        if (!dirtyRef.current) setSaveState('saved')
                    }
                    return true
                } catch (error) {
                    dirtyRef.current = true
                    if (aliveRef.current) {
                        setSaveState('error')
                        if (!notifiedRef.current) {
                            notifiedRef.current = true
                            pushError(error, 'Could not save this note.')
                        }
                    }
                    return false
                }
            }

            chainRef.current = chainRef.current.then(run, run)
            return chainRef.current
        },
        [note.id, previewNote, pushError, updateNote]
    )

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
        }, AUTOSAVE_DELAY_MS)
    }, [])

    const flush = useCallback(async (): Promise<boolean> => {
        return persistRef.current()
    }, [])

    const flushRef = useRef(flush)

    useEffect(() => {
        flushRef.current = flush
    }, [flush])

    useEffect(() => {
        setSaveHandler(() => persistRef.current(true))
        return () => setSaveHandler(null)
    }, [setSaveHandler])

    // The Tasks view can tick a task while this note is open. Apply it to the
    // live document so the note stays open and the edit is saved by autosave.
    useEffect(() => {
        setTaskToggleHandler((noteId, blockId, checked) => {
            if (noteId !== note.id) return false
            return blockEditor.current?.setTaskChecked(blockId, checked) ?? false
        })
        return () => setTaskToggleHandler(null)
    }, [note.id, setTaskToggleHandler])

    useEffect(() => {
        aliveRef.current = true
        return () => {
            aliveRef.current = false
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
            // Leaving the note is the last chance to name a body-only note.
            void persistRef.current(true)
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

    // A task row asks for its block to be shown. The editor mounts a frame or
    // two after the note switches, so wait for the handle before scrolling.
    useEffect(() => {
        if (!revealTarget || revealTarget.noteId !== note.id) return

        let frame = 0
        let attempts = 0
        let cancelled = false

        const attempt = (): void => {
            if (cancelled) return
            if (blockEditor.current?.revealBlock(revealTarget.blockId)) {
                clearReveal(revealTarget.nonce)
                return
            }
            attempts += 1
            if (attempts < 120) frame = window.requestAnimationFrame(attempt)
        }

        frame = window.requestAnimationFrame(attempt)
        return () => {
            cancelled = true
            window.cancelAnimationFrame(frame)
        }
    }, [clearReveal, note.id, revealTarget])

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
            pushError(caught, 'Could not change the note color.')
        }
    }

    const applyFindResult = (result: { count: number; index: number } | undefined): void => {
        if (!result) return
        setFindCount(result.count)
        setFindIndex(result.index)
    }

    const runFind = (query: string, caseSensitive = findCase): void => {
        applyFindResult(blockEditor.current?.find(query, caseSensitive))
    }

    const openFind = (): void => {
        setFindOpen(true)
        window.requestAnimationFrame(() => {
            findInput.current?.focus()
            findInput.current?.select()
            runFind(findQuery)
        })
    }

    const closeFind = useCallback((): void => {
        setFindOpen(false)
        setFindCount(0)
        setFindIndex(0)
        blockEditor.current?.clearFind()
    }, [])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (!(event.metaKey || event.ctrlKey)) return
            if (event.shiftKey || event.altKey) return
            if (event.key.toLowerCase() !== 'f') return
            if (document.querySelector('.palette-panel, .dialog-panel')) return
            event.preventDefault()
            openFind()
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
        // The handler needs the latest query and case, so it is rebuilt with
        // them rather than reading stale state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [findQuery, findCase])

    useEffect(() => {
        if (!findOpen) return

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            closeFind()
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [closeFind, findOpen])

    const changeFindQuery = (next: string): void => {
        setFindQuery(next)
        runFind(next)
    }

    const toggleFindCase = (): void => {
        const next = !findCase
        setFindCase(next)
        runFind(findQuery, next)
    }

    const findNext = (backwards = false): void => {
        applyFindResult(
            backwards ? blockEditor.current?.findPrevious() : blockEditor.current?.findNext()
        )
    }

    const replaceCurrent = (): void => {
        applyFindResult(blockEditor.current?.replaceCurrent(replaceValue))
    }

    const replaceAll = (): void => {
        applyFindResult(blockEditor.current?.replaceAll(replaceValue))
    }

    const chooseTransfer = async (format: NoteTransferFormat): Promise<void> => {
        if (transfer === 'copy') {
            await copyNote(note.id, format)
            return
        }
        await exportNote(note.id, format)
    }

    const findStatus =
        findQuery.trim().length === 0
            ? ''
            : findCount === 0
              ? 'No matches'
              : `${findIndex + 1} of ${findCount}`

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
                    className={`icon-button ${note.isPinned ? 'is-active' : ''}`}
                    aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
                    aria-pressed={note.isPinned}
                    title={note.isPinned ? 'Unpin note' : 'Pin note'}
                    onClick={() => void togglePinned(note.id)}
                >
                    <Pin size={16} fill={note.isPinned ? 'currentColor' : 'none'} />
                </button>
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

            {onToggleFocus && !note.isInTrash && (
                <button
                    type="button"
                    className="icon-button"
                    aria-label="Focus mode"
                    title="Focus mode"
                    onClick={onToggleFocus}
                >
                    <Focus size={16} />
                </button>
            )}

            {!note.isInTrash && (
                <button
                    type="button"
                    className="icon-button"
                    aria-label="Note graph"
                    title="Note graph"
                    onClick={() => setGraphOpen(true)}
                >
                    <Network size={16} />
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
        </div>
    )

    return (
        <section
            className="editor-pane"
            aria-label="Note editor"
            data-hidden={hidden ? 'true' : 'false'}
        >
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

            {findOpen && (
                <div className="find-bar" role="search" aria-label="Find in note">
                    <div className="find-row">
                        <Search size={14} className="find-icon" aria-hidden="true" />
                        <input
                            ref={findInput}
                            className="find-input"
                            type="text"
                            value={findQuery}
                            placeholder="Find in note"
                            aria-label="Find in note"
                            autoComplete="off"
                            spellCheck={false}
                            onChange={(event) => changeFindQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault()
                                    findNext(event.shiftKey)
                                }
                                if (event.key === 'Escape') {
                                    event.preventDefault()
                                    closeFind()
                                }
                            }}
                        />
                        <span className="find-status" aria-live="polite">
                            {findStatus}
                        </span>
                        <button
                            type="button"
                            className="icon-button icon-button--small find-step"
                            aria-label="Previous match"
                            title="Previous match (Shift+Enter)"
                            disabled={findCount === 0}
                            onClick={() => findNext(true)}
                        >
                            <ChevronUp size={15} />
                        </button>
                        <button
                            type="button"
                            className="icon-button icon-button--small find-step"
                            aria-label="Next match"
                            title="Next match (Enter)"
                            disabled={findCount === 0}
                            onClick={() => findNext(false)}
                        >
                            <ChevronDown size={15} />
                        </button>
                        <button
                            type="button"
                            className="find-case"
                            aria-label="Match case"
                            aria-pressed={findCase}
                            title="Match case"
                            data-active={findCase ? 'true' : 'false'}
                            onClick={toggleFindCase}
                        >
                            Aa
                        </button>
                        <button
                            type="button"
                            className="icon-button icon-button--small find-close"
                            aria-label="Close find"
                            title="Close find (Esc)"
                            onClick={closeFind}
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {!note.isInTrash && (
                        <div className="find-row find-row--replace">
                            <input
                                className="find-input"
                                type="text"
                                value={replaceValue}
                                placeholder="Replace with"
                                aria-label="Replace with"
                                autoComplete="off"
                                spellCheck={false}
                                onChange={(event) => setReplaceValue(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault()
                                        replaceCurrent()
                                    }
                                    if (event.key === 'Escape') {
                                        event.preventDefault()
                                        closeFind()
                                    }
                                }}
                            />
                            <button
                                type="button"
                                className="button button--secondary button--small"
                                disabled={findCount === 0}
                                onClick={replaceCurrent}
                            >
                                Replace
                            </button>
                            <button
                                type="button"
                                className="button button--secondary button--small"
                                disabled={findCount === 0}
                                onClick={replaceAll}
                            >
                                Replace all
                            </button>
                        </div>
                    )}
                </div>
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
                            title={`Note color: ${note.color ? getNoteColor(note.color).label : ''}`}
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
                        onBlur={() => {
                            // Leaving the title is the moment a body can name
                            // the note. Until then the empty field stays empty.
                            if (note.isInTrash) return
                            if (titleValue.current.trim()) return
                            if (isBlockDocumentEmpty(bodyValue.current)) return
                            schedule()
                        }}
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

            <NoteGraphDialog
                open={graphOpen}
                focusNoteId={note.id}
                onClose={() => setGraphOpen(false)}
            />

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
                onConfirm={handleDelete}
            />
        </section>
    )
}
