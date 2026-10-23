import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
    FileText,
    MoreHorizontal,
    PanelLeftClose,
    PanelLeftOpen,
    Pencil,
    Plus,
    Search,
    Settings,
    Star,
    Trash2,
    X
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { Note, NotesView } from '../../../shared/model/note'
import { sameTag } from '../../../shared/util/tags'
import { useToast } from '../state/toast'
import { useWorkspace } from '../state/workspace'
import ConfirmDialog from './ConfirmDialog'
import TagDialog from './TagDialog'

type SidebarProps = {
    overlay: boolean
    open: boolean
    collapsed: boolean
    onToggleCollapsed: () => void
    onClose: () => void
}

type NavItem = {
    view: NotesView
    label: string
    icon: JSX.Element
    count: number
}

function countFor(notes: Note[], predicate: (note: Note) => boolean): number {
    return notes.filter(predicate).length
}

export default function Sidebar({
    overlay,
    open,
    collapsed,
    onToggleCollapsed,
    onClose
}: SidebarProps): JSX.Element {
    const {
        notes,
        tags,
        view,
        activeTag,
        setView,
        setActiveTag,
        closeNote,
        createTag,
        renameTag,
        deleteTag,
        openSettings
    } = useWorkspace()
    const { push } = useToast()

    const [tagDialog, setTagDialog] = useState<'create' | 'rename' | null>(null)
    const [editingTag, setEditingTag] = useState('')
    const [deletingTag, setDeletingTag] = useState<string | null>(null)
    const [tagQuery, setTagQuery] = useState('')
    const tagListRef = useRef<HTMLDivElement>(null)

    const navItems = useMemo<NavItem[]>(() => {
        const all = countFor(notes, (note) => !note.isInTrash)
        const favorites = countFor(notes, (note) => !note.isInTrash && note.isFavorite)
        const trash = countFor(notes, (note) => note.isInTrash)

        return [
            { view: 'all', label: 'All notes', icon: <FileText size={16} />, count: all },
            { view: 'favorites', label: 'Favorites', icon: <Star size={16} />, count: favorites },
            { view: 'trash', label: 'Trash', icon: <Trash2 size={16} />, count: trash }
        ]
    }, [notes])

    const sortedTags = useMemo(
        () =>
            [...tags].sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
            ),
        [tags]
    )

    const tagSearchVisible = sortedTags.length > 6

    const filteredTags = useMemo(() => {
        const needle = tagQuery.trim().toLowerCase()
        if (!needle) return sortedTags
        return sortedTags.filter((tag) => tag.name.toLowerCase().includes(needle))
    }, [sortedTags, tagQuery])

    // The tag list can run long, so the search field hands focus straight to the
    // first match and the arrow keys walk the list from there.
    const focusTag = (offset: number): void => {
        const buttons = Array.from(
            tagListRef.current?.querySelectorAll<HTMLButtonElement>('.tag-filter') ?? []
        )
        if (buttons.length === 0) return
        const active = document.activeElement as HTMLElement | null
        const current = buttons.findIndex((button) => button === active)
        const next =
            current === -1 ? 0 : Math.min(buttons.length - 1, Math.max(0, current + offset))
        buttons[next]?.focus()
    }

    const tagCounts = useMemo(() => {
        const counts = new Map<string, number>()
        for (const tag of tags) {
            counts.set(
                tag.name,
                countFor(
                    notes,
                    (note) => !note.isInTrash && note.tags.some((entry) => sameTag(entry, tag.name))
                )
            )
        }
        return counts
    }, [notes, tags])

    useEffect(() => {
        if (!overlay || !open) return

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== 'Escape') return
            onClose()
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose, open, overlay])

    const selectView = (next: NotesView): void => {
        onClose()
        if (overlay) void closeNote()
        void setView(next)
    }

    const selectTag = (name: string): void => {
        onClose()
        void setActiveTag(name)
    }

    const submitTag = async (name: string): Promise<void> => {
        if (tagDialog === 'rename') {
            await renameTag(editingTag, name)
            return
        }

        const tag = await createTag(name)
        push(`Tag “${tag.name}” created.`)
    }

    return (
        <>
            <aside
                className="sidebar"
                data-overlay={overlay ? 'true' : 'false'}
                data-open={open ? 'true' : 'false'}
                data-collapsed={collapsed ? 'true' : 'false'}
                aria-label="Indigo navigation"
            >
                <div className="sidebar-head">
                    <div className="sidebar-heading">
                        <span className="sidebar-title">Indigo</span>
                    </div>
                    <button
                        type="button"
                        className="icon-button sidebar-toggle"
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        aria-expanded={!collapsed}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        onClick={onToggleCollapsed}
                    >
                        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-group">
                        <p className="nav-group-label">Notes</p>
                        {navItems.map((item) => {
                            const selected = view === item.view && activeTag === null
                            return (
                                <button
                                    type="button"
                                    key={item.view}
                                    className="nav-item"
                                    data-active={selected ? 'true' : 'false'}
                                    aria-current={selected ? 'page' : undefined}
                                    aria-label={item.label}
                                    title={item.label}
                                    onClick={() => selectView(item.view)}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    <span className="nav-label">{item.label}</span>
                                    <span className="nav-count">{item.count}</span>
                                </button>
                            )
                        })}
                    </div>

                    <div
                        className="nav-group nav-group--tags"
                        data-empty={sortedTags.length === 0 ? 'true' : 'false'}
                    >
                        <div className="nav-group-head">
                            <p className="nav-group-label">Tags</p>
                            <button
                                type="button"
                                className="nav-add"
                                aria-label="New tag"
                                title="New tag"
                                onClick={() => {
                                    setEditingTag('')
                                    setTagDialog('create')
                                }}
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {tagSearchVisible && (
                            <div className="tag-search-row">
                                <Search size={12} aria-hidden="true" />
                                <input
                                    className="tag-search-input"
                                    type="search"
                                    value={tagQuery}
                                    placeholder="Find a tag"
                                    aria-label="Find a tag"
                                    spellCheck={false}
                                    onChange={(event) => setTagQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'ArrowDown') {
                                            event.preventDefault()
                                            focusTag(0)
                                        }
                                        if (event.key === 'Escape') {
                                            event.preventDefault()
                                            setTagQuery('')
                                        }
                                    }}
                                />
                                {tagQuery && (
                                    <button
                                        type="button"
                                        className="tag-search-clear"
                                        aria-label="Clear tag search"
                                        title="Clear"
                                        onClick={() => setTagQuery('')}
                                    >
                                        <X size={11} />
                                    </button>
                                )}
                            </div>
                        )}

                        {filteredTags.length > 0 ? (
                            <div className="tag-list" ref={tagListRef}>
                                {filteredTags.map((tag) => {
                                    const selected =
                                        activeTag !== null && sameTag(activeTag, tag.name)

                                    return (
                                        <div
                                            className="tag-list-row"
                                            key={tag.name}
                                            data-active={selected ? 'true' : 'false'}
                                        >
                                            <button
                                                type="button"
                                                className="tag-filter"
                                                aria-pressed={selected}
                                                aria-label={`Filter by ${tag.name}`}
                                                title={tag.name}
                                                onClick={() => selectTag(tag.name)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'ArrowDown') {
                                                        event.preventDefault()
                                                        focusTag(1)
                                                    }
                                                    if (event.key === 'ArrowUp') {
                                                        event.preventDefault()
                                                        focusTag(-1)
                                                    }
                                                }}
                                            >
                                                <span className="tag-filter-name">{tag.name}</span>
                                                <span className="tag-filter-count">
                                                    {tagCounts.get(tag.name) ?? 0}
                                                </span>
                                            </button>

                                            <Menu as="div" className="menu-root tag-menu">
                                                <MenuButton
                                                    type="button"
                                                    className="icon-button icon-button--small tag-menu-button"
                                                    aria-label={`Manage tag ${tag.name}`}
                                                    title={`Manage ${tag.name}`}
                                                >
                                                    <MoreHorizontal size={14} />
                                                </MenuButton>
                                                <MenuItems
                                                    anchor="right start"
                                                    portal
                                                    transition
                                                    className="menu-panel menu-panel--small"
                                                >
                                                    <MenuItem
                                                        as="button"
                                                        className="menu-item"
                                                        onClick={() => {
                                                            setEditingTag(tag.name)
                                                            setTagDialog('rename')
                                                        }}
                                                    >
                                                        <Pencil size={14} />
                                                        Rename tag
                                                    </MenuItem>
                                                    <MenuItem
                                                        as="button"
                                                        className="menu-item menu-item--danger"
                                                        onClick={() => setDeletingTag(tag.name)}
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete tag
                                                    </MenuItem>
                                                </MenuItems>
                                            </Menu>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="tag-list-empty">
                                {tagQuery ? 'No tags match that name.' : null}
                            </p>
                        )}
                    </div>
                </nav>

                <footer className="sidebar-foot">
                    <button
                        type="button"
                        className="nav-item nav-item--quiet"
                        aria-haspopup="dialog"
                        aria-label="Settings"
                        title="Settings"
                        onClick={() => {
                            onClose()
                            openSettings()
                        }}
                    >
                        <span className="nav-icon">
                            <Settings size={16} />
                        </span>
                        <span className="nav-label">Settings</span>
                    </button>
                </footer>
            </aside>

            <TagDialog
                key={tagDialog === null ? 'closed' : `${tagDialog}:${editingTag}`}
                open={tagDialog !== null}
                mode={tagDialog === 'rename' ? 'rename' : 'create'}
                initialName={editingTag}
                onClose={() => {
                    setTagDialog(null)
                    setEditingTag('')
                }}
                onSubmit={submitTag}
            />

            <ConfirmDialog
                open={deletingTag !== null}
                title={deletingTag ? `Delete the tag “${deletingTag}”?` : 'Delete this tag?'}
                description="The tag will be removed from every note. The notes themselves stay in your library."
                confirmLabel="Delete tag"
                tone="danger"
                onClose={() => setDeletingTag(null)}
                onConfirm={async () => {
                    if (!deletingTag) return
                    await deleteTag(deletingTag)
                }}
            />
        </>
    )
}
