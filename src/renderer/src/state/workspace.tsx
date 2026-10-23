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
    NotePatch,
    Notes,
    NotesSort,
    NotesView,
    StorageInfo,
    Tag,
    Tags
} from '../../../shared/model/note'
import { extractPlainText, isBlockDocumentEmpty } from '../../../shared/util/noteText'
import { sameTag } from '../../../shared/util/tags'
import { countLabel } from '../lib/format'
import { messageFromError } from '../lib/errors'
import { useToast } from './toast'

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
    setView: (view: NotesView) => Promise<void>
    setActiveTag: (tag: string | null) => Promise<void>
    setSearch: (value: string) => void
    setSort: (sort: NotesSort) => void
    openNote: (id: string) => Promise<void>
    closeNote: () => Promise<void>
    createNote: () => Promise<void>
    previewNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => void
    updateNote: (patch: NotePatch) => Promise<Note>
    toggleFavorite: (id: string) => Promise<void>
    duplicateNote: (id: string) => Promise<void>
    copyNoteText: (id: string) => Promise<void>
    moveToTrash: (id: string) => Promise<void>
    restoreNote: (id: string) => Promise<void>
    deleteNote: (id: string) => Promise<void>
    emptyTrash: () => Promise<void>
    createTag: (name: string) => Promise<Tag>
    renameTag: (oldName: string, nextName: string) => Promise<void>
    deleteTag: (name: string) => Promise<void>
    refresh: () => Promise<void>
    saveNow: () => Promise<void>
    setSaveHandler: (handler: (() => Promise<void>) | null) => void
    openSettings: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function matchesView(note: Note, view: NotesView): boolean {
    if (view === 'trash') return note.isInTrash
    if (view === 'favorites') return !note.isInTrash && note.isFavorite
    return !note.isInTrash
}

function isBlankNote(note: Note | null | undefined): boolean {
    return !!note && note.title.trim().length === 0 && isBlockDocumentEmpty(note.body)
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

    const notesRef = useRef(notes)
    const saveHandler = useRef<(() => Promise<void>) | null>(null)

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
        try {
            const [nextNotes, nextTags, info] = await Promise.all([
                window.indigo.notes.list(),
                window.indigo.tags.list(),
                window.indigo.storage.getInfo()
            ])
            setNotes(nextNotes)
            setTags(nextTags)
            setStorage(info)
            setError(null)
        } catch (caught) {
            setError(messageFromError(caught, 'Could not read your notes folder.'))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        // The load is asynchronous; state only changes after the IPC round trip.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load()
    }, [load])

    const refresh = useCallback(async (): Promise<void> => {
        await load()
    }, [load])

    const saveNow = useCallback(async (): Promise<void> => {
        await saveHandler.current?.()
    }, [])

    const setSaveHandler = useCallback((handler: (() => Promise<void>) | null): void => {
        saveHandler.current = handler
    }, [])

    /**
     * Empty drafts are not notes. Before leaving a note, the freshly saved copy
     * is checked, so a note that only just received a title is kept.
     */
    const discardBlankNote = useCallback(
        async (id: string | null): Promise<void> => {
            if (!id) return

            try {
                const note = await window.indigo.notes.get(id)
                if (!isBlankNote(note)) return

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
        async (id: string): Promise<void> => {
            if (id === activeNoteId) return
            await saveNow()
            await discardBlankNote(activeNoteId)
            setSearchState('')
            setActiveNoteId(id)
        },
        [activeNoteId, discardBlankNote, saveNow]
    )

    const closeNote = useCallback(async (): Promise<void> => {
        await saveNow()
        await discardBlankNote(activeNoteId)
        setActiveNoteId(null)
    }, [activeNoteId, discardBlankNote, saveNow])

    const setView = useCallback(
        async (next: NotesView): Promise<void> => {
            await saveNow()
            await discardBlankNote(activeNoteId)
            setViewState(next)
            setActiveTagState(null)

            const current = notesRef.current.find((note) => note.id === activeNoteId)
            if (current && !matchesView(current, next)) setActiveNoteId(null)
        },
        [activeNoteId, discardBlankNote, saveNow]
    )

    const setActiveTag = useCallback(
        async (tag: string | null): Promise<void> => {
            await saveNow()
            await discardBlankNote(activeNoteId)
            setActiveNoteId(null)
            setSearchState('')

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
    }, [])

    const setSort = useCallback((value: NotesSort): void => {
        setSortState(value)
    }, [])

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
            await saveNow()
            await discardBlankNote(activeNoteId)
            const favorite = view === 'favorites' && !activeTag
            const created = await window.indigo.notes.create({
                isFavorite: favorite,
                tags: activeTag ? [activeTag] : []
            })

            setNotes((current) => [created, ...current])
            setSearchState('')
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

    const duplicateNote = useCallback(
        async (id: string): Promise<void> => {
            try {
                await saveNow()
                const current = await window.indigo.notes.get(id)
                if (isBlankNote(current)) return

                const duplicate = await window.indigo.notes.duplicate(id)
                setNotes((current) => [duplicate, ...current])
                setActiveNoteId(duplicate.id)
                setSearchState('')
                setViewState('all')
                setActiveTagState(null)
                push('Note duplicated.')
            } catch (caught) {
                pushError(caught, 'Could not duplicate that note.')
            }
        },
        [saveNow, push, pushError]
    )

    const copyNoteText = useCallback(
        async (id: string): Promise<void> => {
            const note = notesRef.current.find((entry) => entry.id === id)
            if (!note) return

            const body = extractPlainText(note.body)
            const text = [note.title.trim(), body].filter(Boolean).join('\n\n')

            try {
                await navigator.clipboard.writeText(text)
                push(text ? 'Note copied as text.' : 'Nothing to copy yet.')
            } catch (caught) {
                pushError(caught, 'Could not copy this note.')
            }
        },
        [push, pushError]
    )

    const moveToTrash = useCallback(
        async (id: string): Promise<void> => {
            try {
                await saveNow()
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
                await saveNow()
                await updateNote({ id, isInTrash: false })
                setViewState('all')
                setActiveTagState(null)
                setSearchState('')
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
        const query = search.trim().toLowerCase()
        let pool = notes.filter((note) => matchesView(note, view))

        if (activeTag) {
            pool = pool.filter((note) => note.tags.some((tag) => sameTag(tag, activeTag)))
        }

        if (query) {
            pool = pool.filter((note) => {
                if (note.title.toLowerCase().includes(query)) return true
                if (note.tags.some((tag) => tag.toLowerCase().includes(query))) return true
                return extractPlainText(note.body).toLowerCase().includes(query)
            })
        }

        return [...pool].sort((a, b) => {
            if (sort === 'title') {
                const aTitle = a.title.trim().toLowerCase()
                const bTitle = b.title.trim().toLowerCase()
                if (!aTitle && bTitle) return 1
                if (aTitle && !bTitle) return -1
                return aTitle.localeCompare(bTitle)
            }
            return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
        })
    }, [notes, view, activeTag, search, sort])

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
            setView,
            setActiveTag,
            setSearch,
            setSort,
            openNote,
            closeNote,
            createNote,
            previewNote,
            updateNote,
            toggleFavorite,
            duplicateNote,
            copyNoteText,
            moveToTrash,
            restoreNote,
            deleteNote,
            emptyTrash,
            createTag,
            renameTag,
            deleteTag,
            refresh,
            saveNow,
            setSaveHandler,
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
            setView,
            setActiveTag,
            setSearch,
            setSort,
            openNote,
            closeNote,
            createNote,
            previewNote,
            updateNote,
            toggleFavorite,
            duplicateNote,
            copyNoteText,
            moveToTrash,
            restoreNote,
            deleteNote,
            emptyTrash,
            createTag,
            renameTag,
            deleteTag,
            refresh,
            saveNow,
            setSaveHandler,
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
