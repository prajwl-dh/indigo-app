import { useCallback, useEffect, useState, type JSX } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useAppearance } from '../state/appearance'
import { useWorkspace } from '../state/workspace'
import BrandMark from './BrandMark'
import EmptyCanvas from './EmptyCanvas'
import NoteEditor from './editor/NoteEditor'
import NotesPanel from './notes/NotesPanel'
import SettingsDialog from './SettingsDialog'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import { TitleBarSlotsProvider } from './TitleBarSlots'
import UpdateNotice from './UpdateNotice'
import WindowControls from './WindowControls'

type ShellProps = {
    settingsOpen: boolean
    onCloseSettings: () => void
}

function BootState(): JSX.Element {
    return (
        <div className="boot-state" role="status" aria-label="Opening Indigo">
            <div className="boot-mark" aria-hidden="true">
                <BrandMark size={34} />
            </div>
            <p className="boot-name">Indigo</p>
            <p className="boot-copy">Opening your library…</p>
        </div>
    )
}

export default function Shell({ settingsOpen, onCloseSettings }: ShellProps): JSX.Element {
    const { ready } = useAppearance()
    const { notes, loading, activeNote, search, setSearch, closeNote } = useWorkspace()

    const isNarrow = useMediaQuery('(max-width: 1023px)')
    const isCompact = useMediaQuery('(max-width: 859px)')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return window.localStorage.getItem('indigo:sidebar-collapsed') === 'true'
        } catch {
            return false
        }
    })
    // Focus mode is a way of writing in this session, not a preference: the
    // app always opens with its navigation in place.
    const [focusMode, setFocusMode] = useState(false)

    const leaveFocus = useCallback((): void => {
        setFocusMode(false)
    }, [])

    const toggleFocus = useCallback((): void => {
        setDrawerOpen(false)
        // On a compact window a search covers the editor; focus mode is for
        // the page, so the search steps aside with the rest of the chrome.
        setSearch('')
        setFocusMode((current) => !current)
    }, [setSearch])

    // Escape is the edit shortcut inside the editor (leaving code blocks, for
    // example), so focus mode only yields to it from the material around the
    // writing surface.
    useEffect(() => {
        if (!focusMode) return

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== 'Escape') return
            const target = event.target as HTMLElement | null
            if (target?.closest('.bn-editor, .note-title, input, textarea, [role="dialog"]')) {
                return
            }
            event.preventDefault()
            setFocusMode(false)
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [focusMode])

    // A focus session belongs to the note being written; closing it returns
    // the rest of the app.
    useEffect(() => {
        if (!focusMode || activeNote) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFocusMode(false)
    }, [activeNote, focusMode])

    const toggleSidebar = useCallback((): void => {
        // On a narrow window the expanded sidebar is an overlay, so the same
        // control opens and closes it. On wider windows it collapses to the rail.
        if (isNarrow) {
            setDrawerOpen((current) => !current)
            return
        }

        setCollapsed((current) => {
            const next = !current
            try {
                window.localStorage.setItem('indigo:sidebar-collapsed', String(next))
            } catch {
                // A full storage quota should not stop the sidebar from moving.
            }
            return next
        })
    }, [isNarrow])

    useEffect(() => {
        const wide = window.matchMedia('(min-width: 1024px)')
        const onChange = (event: MediaQueryListEvent): void => {
            if (event.matches) setDrawerOpen(false)
        }

        wide.addEventListener('change', onChange)
        return () => wide.removeEventListener('change', onChange)
    }, [])

    useEffect(() => {
        if (!isNarrow) return
        document.body.dataset.drawer = drawerOpen ? 'open' : 'closed'
        return () => {
            delete document.body.dataset.drawer
        }
    }, [drawerOpen, isNarrow])

    const searching = search.trim().length > 0
    // On a compact window a search covers the editor. Keep the editor mounted
    // and hide it instead of unmounting it, so an unsaved edit is never lost
    // just because the writer typed in the search field.
    const editorHidden = isCompact && searching
    const editorVisible = activeNote !== null && !editorHidden
    const booting = !ready || (loading && notes.length === 0)
    const focusActive = focusMode && activeNote !== null

    return (
        <div className="app-shell" data-focus={focusActive ? 'true' : 'false'}>
            <TitleBarSlotsProvider>
                <TitleBar
                    isCompact={isCompact}
                    onSearchActivate={() => {
                        setDrawerOpen(false)
                        setFocusMode(false)
                    }}
                />

                {focusActive && (
                    <div className="focus-bar" data-platform={window.indigo.platform}>
                        <button
                            type="button"
                            className="focus-exit"
                            aria-label="Exit focus mode"
                            title="Exit focus mode (Esc)"
                            onClick={leaveFocus}
                        >
                            Exit focus
                            <kbd className="focus-key" aria-hidden="true">
                                Esc
                            </kbd>
                        </button>
                        <WindowControls />
                    </div>
                )}

                <div className="workspace">
                    {isNarrow && drawerOpen && (
                        <button
                            type="button"
                            className="drawer-scrim"
                            aria-label="Close navigation"
                            tabIndex={-1}
                            onClick={() => setDrawerOpen(false)}
                        />
                    )}

                    <Sidebar
                        overlay={isNarrow}
                        open={!isNarrow || drawerOpen}
                        collapsed={isNarrow ? !drawerOpen : collapsed}
                        onToggleCollapsed={toggleSidebar}
                        onClose={() => setDrawerOpen(false)}
                    />

                    <main className="workspace-main">
                        {booting ? (
                            <BootState />
                        ) : (
                            <div
                                className="panes"
                                data-compact={isCompact ? 'true' : 'false'}
                                data-editor={editorVisible ? 'open' : 'closed'}
                                data-focus={focusActive ? 'true' : 'false'}
                            >
                                <NotesPanel />

                                {activeNote ? (
                                    <NoteEditor
                                        key={activeNote.id}
                                        note={activeNote}
                                        isCompact={isCompact}
                                        hidden={editorHidden}
                                        onToggleFocus={toggleFocus}
                                        onBack={() => void closeNote()}
                                    />
                                ) : (
                                    <EmptyCanvas />
                                )}
                            </div>
                        )}
                    </main>
                </div>
            </TitleBarSlotsProvider>

            {!settingsOpen && <UpdateNotice />}
            <SettingsDialog open={settingsOpen} onClose={onCloseSettings} />
        </div>
    )
}
