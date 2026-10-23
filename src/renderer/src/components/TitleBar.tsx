import {
    useCallback,
    useEffect,
    useRef,
    type JSX,
    type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { Search, X } from 'lucide-react'
import WindowControls from './WindowControls'
import { useTitleBarSlots } from './titleBarSlotContext'
import { shortcutKey } from '../lib/platform'
import { useWorkspace } from '../state/workspace'

type TitleBarProps = {
    isCompact: boolean
    onSearchActivate: () => void
}

export default function TitleBar({ isCompact, onSearchActivate }: TitleBarProps): JSX.Element {
    const { setActions, setBack } = useTitleBarSlots()
    const { search, setSearch, visibleNotes, openNote, createNote, saveNow, view, activeTag } =
        useWorkspace()
    const inputRef = useRef<HTMLInputElement>(null)

    const focusSearch = useCallback((): void => {
        onSearchActivate()
        window.requestAnimationFrame(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
        })
    }, [onSearchActivate])

    useEffect(() => {
        const unsubscribeSearch = window.indigo.menu.onSearch(focusSearch)
        const unsubscribeNew = window.indigo.menu.onNewNote(() => {
            void createNote()
        })
        const unsubscribeSave = window.indigo.menu.onSave(() => {
            void saveNow()
        })

        return () => {
            unsubscribeSearch()
            unsubscribeNew()
            unsubscribeSave()
        }
    }, [createNote, focusSearch, saveNow])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (!(event.metaKey || event.ctrlKey)) return
            if (event.key.toLowerCase() !== 'k') return
            event.preventDefault()
            focusSearch()
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [focusSearch])

    const placeholder =
        activeTag !== null
            ? `Search in ${activeTag}`
            : view === 'trash'
              ? 'Search trash'
              : view === 'favorites'
                ? 'Search favorites'
                : 'Search notes'

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'Escape') {
            event.preventDefault()
            if (search) {
                setSearch('')
            } else {
                inputRef.current?.blur()
            }
            return
        }

        if (event.key === 'Enter') {
            const first = visibleNotes[0]
            if (!first) return
            event.preventDefault()
            void openNote(first.id)
            inputRef.current?.blur()
        }
    }

    return (
        <header
            className="titlebar"
            data-platform={window.indigo.platform}
            onDoubleClick={(event) => {
                const target = event.target as HTMLElement
                if (
                    window.indigo.platform !== 'darwin' &&
                    !target.closest('[data-no-drag]') &&
                    !target.closest('button')
                ) {
                    void window.indigo.window.toggleMaximize()
                }
            }}
        >
            <div className="titlebar-left">
                <div className="titlebar-slot" ref={setBack} />
            </div>

            <div className="titlebar-center">
                <div className="search-field" role="search">
                    <Search className="search-icon" size={15} aria-hidden="true" />
                    <input
                        ref={inputRef}
                        className="search-input"
                        type="search"
                        value={search}
                        placeholder={isCompact ? 'Search' : placeholder}
                        aria-label="Search notes"
                        spellCheck={false}
                        onFocus={onSearchActivate}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    {search ? (
                        <button
                            type="button"
                            className="search-clear"
                            aria-label="Clear search"
                            title="Clear search"
                            onClick={() => {
                                setSearch('')
                                inputRef.current?.focus()
                            }}
                        >
                            <X size={13} />
                        </button>
                    ) : (
                        <kbd className="search-kbd" aria-hidden="true">
                            <span>{shortcutKey}</span>K
                        </kbd>
                    )}
                </div>
            </div>

            <div className="titlebar-right">
                <div className="titlebar-slot titlebar-slot--actions" ref={setActions} />
                <WindowControls />
            </div>
        </header>
    )
}
