import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type JSX,
    type ReactNode
} from 'react'
import type {
    Note,
    NoteExport,
    NotePatch,
    NoteTransferFormat,
    Notes,
    NotesSort,
    NotesView,
    SavedSearch,
    SavedSearches,
    StorageInfo,
    Tag,
    Tags
} from '../../../shared/model/note'
import { isBlockDocumentEmpty } from '../../../shared/util/noteText'
import { extractTasks, setTaskChecked, type NoteTask } from '../../../shared/util/noteTasks'
import { extractNoteLinkIds } from '../../../shared/util/noteLinks'
import { noteMatchesSearch, parseSearch } from '../../../shared/util/noteSearch'
import {
    noteToHTMLFragment,
    noteToMarkdown,
    noteToText,
    transferLabel
} from '../../../shared/util/noteTransfer'
import { sameTag } from '../../../shared/util/tags'
import { countLabel } from '../lib/format'
import { messageFromError } from '../lib/errors'
import { useToast } from './toast'

export type WorkspaceTask = {
    note: Note
    task: NoteTask
}

/** A block the editor should scroll to once its note is on screen. */
export type RevealTarget = {
    noteId: string
    blockId: string
    nonce: number
}

/** Toggles a task inside the open editor so the note does not have to close. */
type TaskToggleHandler = (noteId: string, blockId: string, checked: boolean) => boolean

type WorkspaceContextValue = {
    notes: Notes
    visibleNotes: Notes
    tags: Tags
    storage: StorageInfo | null
    loading: boolean
    error: string | null
    activeNote: Note | null
    view: NotesView
    activeTag: string | null
    search: string
    sort: NotesSort
    savedSearches: SavedSearches
    activeSavedSearchId: string | null
    setView: (view: NotesView) => Promise<void>
    setActiveTag: (tag: string | null) => Promise<void>
    setSearch: (value: string) => void
    setSort: (sort: NotesSort) => void
    applySavedSearch: (id: string) => Promise<void>
    createSavedSearch: (name: string) => Promise<SavedSearch>
    renameSavedSearch: (id: string, name: string) => Promise<void>
    deleteSavedSearch: (id: string) => Promise<void>
    clearSavedSearch: () => void
    openNote: (id: string) => Promise<boolean>
    /** Opens the note, then asks the editor to scroll a block into view. */
    revealBlock: (noteId: string, blockId: string) => Promise<void>
    revealTarget: RevealTarget | null
    clearReveal: (nonce: number) => void
    /** Closes the note. False when pending edits could not be saved. */
    closeNote: () => Promise<boolean>
    createNote: () => Promise<void>
    previewNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => void
    updateNote: (patch: NotePatch) => Promise<Note>
    toggleFavorite: (id: string) => Promise<void>
    togglePinned: (id: string) => Promise<void>
    duplicateNote: (id: string) => Promise<void>
    copyNote: (id: string, format: NoteTransferFormat) => Promise<void>
    exportNote: (id: string, format: NoteTransferFormat) => Promise<void>
    bulkUpdate: (ids: string[], patch: Partial<NotePatch>) => Promise<number>
    bulkMoveToTrash: (ids: string[]) => Promise<void>
    bulkRestore: (ids: string[]) => Promise<void>
    bulkDelete: (ids: string[]) => Promise<void>
    backlinksFor: (id: string) => Note[]
    tasks: WorkspaceTask[]
    toggleTask: (noteId: string, blockId: string, checked: boolean) => Promise<void>
    setTaskToggleHandler: (handler: TaskToggleHandler | null) => void
    moveToTrash: (id: string) => Promise<void>
    restoreNote: (id: string) => Promise<void>
    deleteNote: (id: string) => Promise<void>
    emptyTrash: () => Promise<void>
    createTag: (name: string) => Promise<Tag>
    renameTag: (oldName: string, nextName: string) => Promise<void>
    deleteTag: (name: string) => Promise<void>
    refresh: () => Promise<void>
    /** Save pending edits. Returns false when the editor could not save. */
    saveNow: () => Promise<boolean>
    flushNow: () => Promise<void>
    setSaveHandler: (handler: (() => Promise<boolean>) | null) => void
    openSettings: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function matchesView(note: Note, view: NotesView): boolean {
    if (view === 'trash') return note.isInTrash
    if (view === 'favorites') return !note.isInTrash && note.isFavorite
    // The tasks view shares the library's pool; its list is a different
    // read of the same notes rather than a different set of notes.
    return !note.isInTrash
}

function isBlankNote(note: Note | null | undefined): boolean {
    return !!note && note.title.trim().length === 0 && isBlockDocumentEmpty(note.body)
}

function byLastModified(a: Note, b: Note): number {
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
}

function byTitle(a: Note, b: Note): number {
    const aTitle = a.title.trim().toLowerCase()
    const bTitle = b.title.trim().toLowerCase()
    if (!aTitle && bTitle) return 1
    if (aTitle && !bTitle) return -1
    return aTitle.localeCompare(bTitle)
}

export function WorkspaceProvider({
    children,
    onOpenSettings
}: {
    children: ReactNode
    onOpenSettings: () => void
}): JSX.Element {
    const { push, pushError } = useToast()

    const [notes, setNotes] = useState<Notes>([])
    const [tags, setTags] = useState<Tags>([])
    const [storage, setStorage] = useState<StorageInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
    const [view, setViewState] = useState<NotesView>('all')
    const [activeTag, setActiveTagState] = useState<string | null>(null)
    const [search, setSearchState] = useState('')
    const [sort, setSortState] = useState<NotesSort>('updated')
    const [savedSearches, setSavedSearches] = useState<SavedSearches>([])
    const [activeSavedSearchId, setActiveSavedSearchId] = useState<string | null>(null)
    const [revealTarget, setRevealTarget] = useState<RevealTarget | null>(null)
    const revealNonce = useRef(0)

    const notesRef = useRef(notes)
    const saveHandler = useRef<(() => Promise<boolean>) | null>(null)
    const taskToggleHandler = useRef<TaskToggleHandler | null>(null)

    useEffect(() => {
        notesRef.current = notes
    }, [notes])

    const storageInfo = useMemo<StorageInfo | null>(
        () => (storage ? { ...storage, noteCount: notes.length } : null),
        [notes.length, storage]
    )

    const refreshTaxonomy = useCallback(async (): Promise<void> => {
        try {
            const nextTags = await window.indigo.tags.list()
            setTags(nextTags)
        } catch (caught) {
            console.warn('[tags] could not refresh', caught)
        }
    }, [])

    const load = useCallback(async (): Promise<void> => {
        setLoading(true)

        // Load tags first: reading them may repair a corrupt file, and the
        // Storage health snapshot should describe the state that follows.
        // A broken tags file must never hide a readable notes folder.
        let nextTags: Tags = []
        try {
            nextTags = await window.indigo.tags.list()
        } catch (caught) {
            console.warn('[tags] could not load', caught)
            pushError(caught, 'Could not read your tags. They were left untouched.')
        }

        try {
            const [nextNotes, info, nextSavedSearches] = await Promise.all([
                window.indigo.notes.list(),
                window.indigo.storage.getInfo(),
                window.indigo.savedSearches.list().catch(() => [])
            ])
            setNotes(nextNotes)
            setTags(nextTags)
            setStorage(info)
            setSavedSearches(nextSavedSearches)
            setError(null)
        } catch (caught) {
            setError(messageFromError(caught, 'Could not read your notes folder.'))
        } finally {
            setLoading(false)
        }
    }, [pushError])

    useEffect(() => {
        // The load is asynchronous; state only changes after the IPC round trip.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load()
    }, [load])

    const refresh = useCallback(async (): Promise<void> => {
        await load()
    }, [load])

    const saveNow = useCallback(async (): Promise<boolean> => {
        if (!saveHandler.current) return true

        try {
            return (await saveHandler.current()) !== false
        } catch (caught) {
            console.warn('[save] could not flush the editor', caught)
            return false
        }
    }, [])

    const flushNow = useCallback(async (): Promise<void> => {
        if (!(await saveNow())) {
            throw new Error('The latest changes could not be saved.')
        }
    }, [saveNow])

    const setSaveHandler = useCallback((handler: (() => Promise<boolean>) | null): void => {
        saveHandler.current = handler
    }, [])

    const setTaskToggleHandler = useCallback((handler: TaskToggleHandler | null): void => {
        taskToggleHandler.current = handler
    }, [])

    useEffect(() => {
        return window.indigo.app.onFlushRequest(flushNow)
    }, [flushNow])

    /**
     * Empty drafts are not notes. Before leaving a note, the freshly saved copy
     * is checked, so a note that only just received a title is kept.
     */
    const discardBlankNote = useCallback(
        async (id: string | null): Promise<void> => {
            if (!id) return

            try {
                const note = await window.indigo.notes.get(id)
                if (!note || note.isDraft !== true || !isBlankNote(note)) return

                await window.indigo.notes.delete(id)
                setNotes((current) => current.filter((entry) => entry.id !== id))
                setActiveNoteId((current) => (current === id ? null : current))
            } catch (caught) {
                pushError(caught, 'Could not discard the empty note.')
            }
        },
        [pushError]
    )

    const openNote = useCallback(
        async (id: string): Promise<boolean> => {
            if (id === activeNoteId) return true
            // Never unmount an editor whose latest edit did not reach disk.
            if (!(await saveNow())) return false
            await discardBlankNote(activeNoteId)

            const target = notesRef.current.find((note) => note.id === id)
            if (target?.isInTrash && view !== 'trash') {
                setViewState('trash')
                setActiveTagState(null)
            }

            setSearchState('')
            setActiveSavedSearchId(null)
            setActiveNoteId(id)
            return true
        },
        [activeNoteId, discardBlankNote, saveNow, view]
    )

    const revealBlock = useCallback(
        async (noteId: string, blockId: string): Promise<void> => {
            // Opening also succeeds when the note is already on screen, so a
            // second click on the same task scrolls again.
            if (!(await openNote(noteId))) return
            revealNonce.current += 1
            setRevealTarget({ noteId, blockId, nonce: revealNonce.current })
        },
        [openNote]
    )

    const clearReveal = useCallback((nonce: number): void => {
        setRevealTarget((current) => (current && current.nonce === nonce ? null : current))
    }, [])

    const closeNote = useCallback(async (): Promise<boolean> => {
        if (!(await saveNow())) return false
        await discardBlankNote(activeNoteId)
        setActiveNoteId(null)
        return true
    }, [activeNoteId, discardBlankNote, saveNow])

    const setView = useCallback(
        async (next: NotesView): Promise<void> => {
            if (!(await saveNow())) return
            await discardBlankNote(activeNoteId)
            setViewState(next)
            setActiveTagState(null)
            setActiveSavedSearchId(null)

            const current = notesRef.current.find((note) => note.id === activeNoteId)
            if (current && !matchesView(current, next)) setActiveNoteId(null)
        },
        [activeNoteId, discardBlankNote, saveNow]
    )

    const setActiveTag = useCallback(
        async (tag: string | null): Promise<void> => {
            if (!(await saveNow())) return
            await discardBlankNote(activeNoteId)
            setActiveNoteId(null)
            setSearchState('')
            setActiveSavedSearchId(null)

            setActiveTagState((current) => {
                if (tag === null) return null
                if (current && sameTag(current, tag)) return null
                return tag
            })
            setViewState('all')
        },
        [activeNoteId, discardBlankNote, saveNow]
    )

    const setSearch = useCallback((value: string): void => {
        setSearchState(value)
        setActiveSavedSearchId(null)
    }, [])

    const setSort = useCallback((value: NotesSort): void => {
        setSortState(value)
    }, [])

    const clearSavedSearch = useCallback((): void => {
        setSearchState('')
        setActiveSavedSearchId(null)
    }, [])

    const applySavedSearch = useCallback(
        async (id: string): Promise<void> => {
            const saved = savedSearches.find((entry) => entry.id === id)
            if (!saved) return

            // Clicking the active saved search again is a gentle way back to
            // the whole library.
            if (activeSavedSearchId === id) {
                clearSavedSearch()
                return
            }

            if (!(await saveNow())) return
            await discardBlankNote(activeNoteId)

            setViewState('all')
            setActiveTagState(null)
            setSearchState(saved.query)
            setActiveSavedSearchId(saved.id)
        },
        [
            activeSavedSearchId,
            activeNoteId,
            clearSavedSearch,
            discardBlankNote,
            saveNow,
            savedSearches
        ]
    )

    const createSavedSearch = useCallback(
        async (name: string): Promise<SavedSearch> => {
            const query = search.trim()
            if (!query) throw new Error('Search for something first.')
            const created = await window.indigo.savedSearches.create(name, query)
            setSavedSearches((current) => [...current, created])
            setViewState('all')
            setActiveTagState(null)
            setSearchState(query)
            setActiveSavedSearchId(created.id)
            push(`Saved “${created.name}”.`)
            return created
        },
        [push, search]
    )

    const renameSavedSearch = useCallback(
        async (id: string, name: string): Promise<void> => {
            const renamed = await window.indigo.savedSearches.rename(id, name)
            setSavedSearches((current) =>
                current.map((entry) => (entry.id === id ? renamed : entry))
            )
            push('Saved search renamed.')
        },
        [push]
    )

    const deleteSavedSearch = useCallback(
        async (id: string): Promise<void> => {
            await window.indigo.savedSearches.delete(id)
            setSavedSearches((current) => current.filter((entry) => entry.id !== id))
            setActiveSavedSearchId((current) => (current === id ? null : current))
            push('Saved search deleted.')
        },
        [push]
    )

    const previewNote = useCallback(
        (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>): void => {
            setNotes((current) =>
                current.map((note) => (note.id === id ? { ...note, ...patch } : note))
            )
        },
        []
    )

    const updateNote = useCallback(
        async (patch: NotePatch): Promise<Note> => {
            const updated = await window.indigo.notes.update(patch)
            setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)))
            if (patch.tags !== undefined) void refreshTaxonomy()
            return updated
        },
        [refreshTaxonomy]
    )

    const createNote = useCallback(async (): Promise<void> => {
        try {
            if (!(await saveNow())) return
            await discardBlankNote(activeNoteId)
            const favorite = view === 'favorites' && !activeTag
            const created = await window.indigo.notes.create({
                isFavorite: favorite,
                tags: activeTag ? [activeTag] : []
            })

            setNotes((current) => [created, ...current])
            setSearchState('')
            setActiveSavedSearchId(null)
            setActiveNoteId(created.id)
            if (view === 'trash') setViewState('all')
            void refreshTaxonomy()
        } catch (caught) {
            pushError(caught, 'Could not create a new note.')
        }
    }, [activeNoteId, activeTag, discardBlankNote, refreshTaxonomy, saveNow, view, pushError])

    const toggleFavorite = useCallback(
        async (id: string): Promise<void> => {
            const note = notesRef.current.find((entry) => entry.id === id)
            if (!note) return
            try {
                await updateNote({ id, isFavorite: !note.isFavorite })
            } catch (caught) {
                pushError(caught, 'Could not update that note.')
            }
        },
        [updateNote, pushError]
    )

    const togglePinned = useCallback(
        async (id: string): Promise<void> => {
            const note = notesRef.current.find((entry) => entry.id === id)
            if (!note) return
            try {
                await updateNote({ id, isPinned: !note.isPinned })
            } catch (caught) {
                pushError(caught, 'Could not update that note.')
            }
        },
        [updateNote, pushError]
    )

    const duplicateNote = useCallback(
        async (id: string): Promise<void> => {
            try {
                if (!(await saveNow())) return
                const current = await window.indigo.notes.get(id)
                if (isBlankNote(current)) return

                const duplicate = await window.indigo.notes.duplicate(id)
                setNotes((current) => [duplicate, ...current])
                setActiveNoteId(duplicate.id)
                setSearchState('')
                setActiveSavedSearchId(null)
                setViewState('all')
                setActiveTagState(null)
                push('Note duplicated.')
            } catch (caught) {
                pushError(caught, 'Could not duplicate that note.')
            }
        },
        [saveNow, push, pushError]
    )

    const copyNote = useCallback(
        async (id: string, format: NoteTransferFormat): Promise<void> => {
            try {
                // Copy reads the document, not the in-memory draft, so a copy
                // taken right after typing still contains the last keystrokes.
                if (notesRef.current.find((entry) => entry.id === id)) {
                    if (!(await saveNow())) return
                }
                const note = await window.indigo.notes.get(id)
                if (!note) return

                const text = noteToText(note)
                const payload =
                    format === 'markdown'
                        ? noteToMarkdown(note)
                        : format === 'html'
                          ? noteToHTMLFragment(note)
                          : text

                if (!payload.trim()) {
                    push('Nothing to copy yet.')
                    return
                }

                if (
                    format === 'html' &&
                    typeof ClipboardItem !== 'undefined' &&
                    navigator.clipboard.write
                ) {
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'text/html': new Blob([payload], { type: 'text/html' }),
                            'text/plain': new Blob([text], { type: 'text/plain' })
                        })
                    ])
                } else {
                    await navigator.clipboard.writeText(payload)
                }
                push(`Note copied as ${transferLabel(format)}.`)
            } catch (caught) {
                pushError(caught, 'Could not copy this note.')
            }
        },
        [push, pushError, saveNow]
    )

    const exportNote = useCallback(
        async (id: string, format: NoteTransferFormat): Promise<void> => {
            try {
                // Export reads the note from disk; make the last edit real first.
                if (notesRef.current.find((entry) => entry.id === id)) {
                    if (!(await saveNow())) return
                }
                const result: NoteExport = await window.indigo.notes.exportNote(id, format)
                push(`“${result.filename}” is in your downloads folder.`)
            } catch (caught) {
                pushError(caught, 'Could not export that note.')
            }
        },
        [saveNow, push, pushError]
    )

    const bulkUpdate = useCallback(
        async (ids: string[], patch: Partial<NotePatch>): Promise<number> => {
            if (ids.length === 0) return 0
            if (!(await saveNow())) return 0

            let updated = 0
            let firstError: unknown = null

            for (const id of ids) {
                try {
                    const next = await window.indigo.notes.update({ ...patch, id })
                    setNotes((current) => current.map((note) => (note.id === id ? next : note)))
                    updated += 1
                } catch (caught) {
                    firstError ??= caught
                }
            }

            if (patch.tags !== undefined) void refreshTaxonomy()
            if (updated > 0) push(`${countLabel(updated, 'note')} updated.`)
            if (firstError) pushError(firstError, 'Some notes could not be updated.')
            return updated
        },
        [push, pushError, refreshTaxonomy, saveNow]
    )

    const bulkMoveToTrash = useCallback(
        async (ids: string[]): Promise<void> => {
            if (ids.length === 0) return
            if (!(await saveNow())) return
            if (activeNoteId && ids.includes(activeNoteId)) {
                if (!(await closeNote())) return
            }

            let moved = 0
            let removed = 0
            let firstError: unknown = null

            for (const id of ids) {
                try {
                    const current = await window.indigo.notes.get(id)
                    if (!current) continue

                    if (isBlankNote(current)) {
                        await window.indigo.notes.delete(id)
                        setNotes((notes) => notes.filter((note) => note.id !== id))
                        removed += 1
                        continue
                    }

                    const next = await window.indigo.notes.update({
                        id,
                        isInTrash: true,
                        isFavorite: false
                    })
                    setNotes((notes) => notes.map((note) => (note.id === id ? next : note)))
                    moved += 1
                } catch (caught) {
                    firstError ??= caught
                }
            }

            const parts: string[] = []
            if (moved > 0) parts.push(`${countLabel(moved, 'note')} moved to trash`)
            if (removed > 0) parts.push(`${countLabel(removed, 'empty draft')} discarded`)
            push(parts.length > 0 ? `${parts.join('; ')}.` : 'Nothing to move.')
            if (firstError) pushError(firstError, 'Some notes could not be moved.')
        },
        [activeNoteId, closeNote, push, pushError, saveNow]
    )

    const bulkRestore = useCallback(
        async (ids: string[]): Promise<void> => {
            if (ids.length === 0) return
            if (!(await saveNow())) return

            let restored = 0
            let firstError: unknown = null

            for (const id of ids) {
                try {
                    const next = await window.indigo.notes.update({ id, isInTrash: false })
                    setNotes((notes) => notes.map((note) => (note.id === id ? next : note)))
                    restored += 1
                } catch (caught) {
                    firstError ??= caught
                }
            }

            if (restored > 0) {
                setViewState('all')
                setActiveTagState(null)
                setActiveSavedSearchId(null)
                push(`${countLabel(restored, 'note')} restored.`)
            }
            if (firstError) pushError(firstError, 'Some notes could not be restored.')
        },
        [push, pushError, saveNow]
    )

    const bulkDelete = useCallback(
        async (ids: string[]): Promise<void> => {
            if (ids.length === 0) return

            let deleted = 0
            let firstError: unknown = null

            for (const id of ids) {
                try {
                    await window.indigo.notes.delete(id)
                    setNotes((notes) => notes.filter((note) => note.id !== id))
                    setActiveNoteId((current) => (current === id ? null : current))
                    deleted += 1
                } catch (caught) {
                    firstError ??= caught
                }
            }

            if (deleted > 0) push(`${countLabel(deleted, 'note')} deleted permanently.`)
            if (firstError) pushError(firstError, 'Some notes could not be deleted.')
        },
        [push, pushError]
    )

    const toggleTask = useCallback(
        async (noteId: string, blockId: string, checked: boolean): Promise<void> => {
            try {
                // While a note is open the editor owns its document. Toggle the
                // block there so the note stays open and the change joins the
                // undo stack; its autosave writes the body to disk.
                if (activeNoteId === noteId) {
                    if (taskToggleHandler.current?.(noteId, blockId, checked)) return
                    // No live editor yet: fall back to closing, which flushes
                    // the pending edit before the patch.
                    if (!(await closeNote())) return
                }

                const note = notesRef.current.find((entry) => entry.id === noteId)
                if (!note) return

                const body = setTaskChecked(note.body, blockId, checked)
                // A body without that block is stale state, not an error.
                if (!body) return

                await window.indigo.notes.update({ id: noteId, body })
                setNotes((current) =>
                    current.map((entry) =>
                        entry.id === noteId
                            ? { ...entry, body, lastModified: new Date().toISOString() }
                            : entry
                    )
                )
            } catch (caught) {
                pushError(caught, 'Could not update that task.')
            }
        },
        [activeNoteId, closeNote, pushError]
    )

    const moveToTrash = useCallback(
        async (id: string): Promise<void> => {
            try {
                if (!(await saveNow())) return
                const current = await window.indigo.notes.get(id)

                // A blank draft never reaches the trash; there is nothing to keep.
                if (isBlankNote(current)) {
                    await window.indigo.notes.delete(id)
                    setNotes((notes) => notes.filter((entry) => entry.id !== id))
                    setActiveNoteId((active) => (active === id ? null : active))
                    return
                }

                await updateNote({ id, isInTrash: true, isFavorite: false })
                setActiveNoteId((current) => (current === id ? null : current))
                push('Note moved to trash.', {
                    action: {
                        label: 'Undo',
                        run: async () => {
                            try {
                                await updateNote({ id, isInTrash: false })
                                push('Note restored.')
                            } catch (caught) {
                                pushError(caught, 'Could not restore that note.')
                            }
                        }
                    }
                })
            } catch (caught) {
                pushError(caught, 'Could not move that note to trash.')
            }
        },
        [saveNow, updateNote, push, pushError]
    )

    const restoreNote = useCallback(
        async (id: string): Promise<void> => {
            try {
                if (!(await saveNow())) return
                await updateNote({ id, isInTrash: false })
                setViewState('all')
                setActiveTagState(null)
                setSearchState('')
                setActiveSavedSearchId(null)
                setActiveNoteId(id)
                push('Note restored to all notes.')
            } catch (caught) {
                pushError(caught, 'Could not restore that note.')
            }
        },
        [saveNow, updateNote, push, pushError]
    )

    const deleteNote = useCallback(
        async (id: string): Promise<void> => {
            try {
                await window.indigo.notes.delete(id)
                setNotes((current) => current.filter((note) => note.id !== id))
                setActiveNoteId((current) => (current === id ? null : current))
                push('Note deleted permanently.')
            } catch (caught) {
                pushError(caught, 'Could not delete that note.')
            }
        },
        [push, pushError]
    )

    const emptyTrash = useCallback(async (): Promise<void> => {
        try {
            const removed = await window.indigo.notes.emptyTrash()
            setNotes((current) => current.filter((note) => !note.isInTrash))
            setActiveNoteId((current) => {
                const note = notesRef.current.find((entry) => entry.id === current)
                return note?.isInTrash ? null : current
            })
            push(
                removed > 0
                    ? `${countLabel(removed, 'note')} removed from trash.`
                    : 'Trash is already empty.'
            )
        } catch (caught) {
            pushError(caught, 'Could not empty the trash.')
        }
    }, [push, pushError])

    const createTag = useCallback(async (name: string): Promise<Tag> => {
        const tag = await window.indigo.tags.create(name)
        setTags((current) =>
            current.some((entry) => sameTag(entry.name, tag.name)) ? current : [...current, tag]
        )
        return tag
    }, [])

    const renameTag = useCallback(
        async (oldName: string, nextName: string): Promise<void> => {
            const tag = await window.indigo.tags.rename(oldName, nextName)
            const nextNotes = await window.indigo.notes.list()

            setNotes(nextNotes)
            setTags((current) =>
                current.map((entry) =>
                    sameTag(entry.name, oldName) ? { ...entry, name: tag.name } : entry
                )
            )
            setActiveTagState((current) =>
                current && sameTag(current, oldName) ? tag.name : current
            )
            push('Tag renamed.')
        },
        [push]
    )

    const deleteTag = useCallback(
        async (name: string): Promise<void> => {
            await window.indigo.tags.delete(name)
            const nextNotes = await window.indigo.notes.list()

            setNotes(nextNotes)
            setTags((current) => current.filter((entry) => !sameTag(entry.name, name)))
            setActiveTagState((current) => (current && sameTag(current, name) ? null : current))
            push('Tag deleted.')
        },
        [push]
    )

    const visibleNotes = useMemo(() => {
        const parsed = parseSearch(search)
        let pool = notes.filter((note) => matchesView(note, view))

        if (activeTag) {
            pool = pool.filter((note) => note.tags.some((tag) => sameTag(tag, activeTag)))
        }

        if (parsed.conditions.length > 0) {
            pool = pool.filter((note) => noteMatchesSearch(note, parsed))
        }

        const byOrder = sort === 'title' ? byTitle : byLastModified

        return [...pool].sort((a, b) => {
            // Pins hold their ground in every sort and every view. A pinned
            // group keeps its normal ordering inside itself.
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
            return byOrder(a, b)
        })
    }, [notes, view, activeTag, search, sort])

    /**
     * Backlinks are derived from the saved documents, not stored twice. A note
     * that links to a shared page cannot get out of step with the link itself.
     */
    const backlinksByNote = useMemo(() => {
        const map = new Map<string, Note[]>()

        for (const note of notes) {
            if (note.isInTrash) continue
            for (const targetId of extractNoteLinkIds(note.body)) {
                const list = map.get(targetId)
                if (!list) {
                    map.set(targetId, [note])
                } else if (!list.some((entry) => entry.id === note.id)) {
                    list.push(note)
                }
            }
        }

        for (const list of map.values()) list.sort(byLastModified)
        return map
    }, [notes])

    const backlinksFor = useCallback(
        (id: string): Note[] => backlinksByNote.get(id) ?? [],
        [backlinksByNote]
    )

    /**
     * Every checkbox in the library in one list. Notes go newest first so a
     * fresh checklist shows up at the top; done items sink within their note.
     */
    const tasks = useMemo<WorkspaceTask[]>(() => {
        const pool = notes.filter((note) => !note.isInTrash).sort(byLastModified)
        const collected: WorkspaceTask[] = []
        for (const note of pool) {
            for (const task of extractTasks(note.body)) {
                collected.push({ note, task })
            }
        }

        return collected.sort((a, b) => {
            if (a.task.checked !== b.task.checked) return a.task.checked ? 1 : -1
            return 0
        })
    }, [notes])

    const activeNote = useMemo(() => {
        const note = notes.find((entry) => entry.id === activeNoteId)
        if (!note) return null
        if (view === 'trash') return note.isInTrash ? note : null
        return note.isInTrash ? null : note
    }, [notes, activeNoteId, view])

    const value = useMemo<WorkspaceContextValue>(
        () => ({
            notes,
            visibleNotes,
            tags,
            storage: storageInfo,
            loading,
            error,
            activeNote,
            view,
            activeTag,
            search,
            sort,
            savedSearches,
            activeSavedSearchId,
            tasks,
            setView,
            setActiveTag,
            setSearch,
            setSort,
            applySavedSearch,
            createSavedSearch,
            renameSavedSearch,
            deleteSavedSearch,
            clearSavedSearch,
            openNote,
            revealBlock,
            revealTarget,
            clearReveal,
            closeNote,
            createNote,
            previewNote,
            updateNote,
            toggleFavorite,
            togglePinned,
            duplicateNote,
            copyNote,
            exportNote,
            bulkUpdate,
            bulkMoveToTrash,
            bulkRestore,
            bulkDelete,
            backlinksFor,
            toggleTask,
            moveToTrash,
            restoreNote,
            deleteNote,
            emptyTrash,
            createTag,
            renameTag,
            deleteTag,
            refresh,
            saveNow,
            flushNow,
            setSaveHandler,
            setTaskToggleHandler,
            openSettings: onOpenSettings
        }),
        [
            notes,
            visibleNotes,
            tags,
            storageInfo,
            loading,
            error,
            activeNote,
            view,
            activeTag,
            search,
            sort,
            savedSearches,
            activeSavedSearchId,
            tasks,
            setView,
            setActiveTag,
            setSearch,
            setSort,
            applySavedSearch,
            createSavedSearch,
            renameSavedSearch,
            deleteSavedSearch,
            clearSavedSearch,
            openNote,
            revealBlock,
            revealTarget,
            clearReveal,
            closeNote,
            createNote,
            previewNote,
            updateNote,
            toggleFavorite,
            togglePinned,
            duplicateNote,
            copyNote,
            exportNote,
            bulkUpdate,
            bulkMoveToTrash,
            bulkRestore,
            bulkDelete,
            backlinksFor,
            toggleTask,
            moveToTrash,
            restoreNote,
            deleteNote,
            emptyTrash,
            createTag,
            renameTag,
            deleteTag,
            refresh,
            saveNow,
            flushNow,
            setSaveHandler,
            setTaskToggleHandler,
            onOpenSettings
        ]
    )

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
    const context = useContext(WorkspaceContext)
    if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider')
    return context
}
