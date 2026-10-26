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
    const { notes, loading, activeNote, search, closeNote } = useWorkspace()

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

    return (
        <div className="app-shell">
            <TitleBarSlotsProvider>
                <TitleBar isCompact={isCompact} onSearchActivate={() => setDrawerOpen(false)} />

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
                            >
                                <NotesPanel />

                                {activeNote ? (
                                    <NoteEditor
                                        key={activeNote.id}
                                        note={activeNote}
                                        isCompact={isCompact}
                                        hidden={editorHidden}
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
