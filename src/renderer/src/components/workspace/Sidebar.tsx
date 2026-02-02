import {
    AlertTriangle,
    Archive,
    Check,
    ChevronLeft,
    ChevronRight,
    Database,
    Edit2,
    Heart,
    Menu,
    Monitor,
    Moon,
    MoreHorizontal,
    Palette,
    Plus,
    Search,
    Sun,
    Trash2,
    X
} from 'lucide-react'
import React from 'react'
import ReactTimeAgo from 'react-time-ago'
import 'react-time-ago/locale/en'
import { useDraggable } from 'react-use-draggable-scroll'
import { Accent, accents } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import { Folder, Folders, Note, Notes } from 'src/shared/model/note'
import { Theme, themes } from 'src/shared/model/theme'
import { capitalizeWords, truncateActiveDatabasePath } from 'src/shared/util/stringUtils'
import Button from '../ui/Button'
import { DialogComponent } from '../ui/DialogComponent'
import FolderChip from '../ui/FolderChip'
import PopoverComponent from '../ui/PopOver'

type SidebarType = {
    activeDatabase: string
    activeAccent: Accent
    isTrashOpened: boolean
    setIsTrashOpened: React.Dispatch<React.SetStateAction<boolean>>
    activeFolder: Folder
    setActiveFolder: React.Dispatch<React.SetStateAction<Folder>>
    notes: Notes
    setNotes: React.Dispatch<React.SetStateAction<Notes>>
    folders: Folders
    setFolders: React.Dispatch<React.SetStateAction<Folders>>
    changeActiveAccent: (accent: Accent) => Promise<void>
    activeTheme: Theme
    changeActiveTheme: (theme: Theme) => Promise<void>
}

export default function Sidebar({
    activeDatabase,
    activeAccent,
    changeActiveAccent,
    activeTheme,
    changeActiveTheme,
    isTrashOpened,
    setIsTrashOpened,
    activeFolder,
    setActiveFolder,
    notes,
    setNotes,
    folders,
    setFolders
}: SidebarType): React.JSX.Element {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(true)
    const [isCreateFolderActive, setIsCreateFolderActive] = React.useState<boolean>(false)
    const [isRenameFolderActive, setIsRenameFolderActive] = React.useState<boolean>(false)
    const [isDeleteFolderDialogActive, setIsDeleteFolderDialogActive] =
        React.useState<boolean>(false)
    const [searchQuery, setSearchQuery] = React.useState<string>('')

    const folderChipRef = React.useRef<HTMLDivElement>(
        null
    ) as React.MutableRefObject<HTMLInputElement>

    const { events } = useDraggable(folderChipRef)

    function toggleSidebar(): void {
        setIsSidebarOpen((prev) => !prev)
    }

    async function createNewNote(): Promise<void> {
        const response: Note = await window.notesApi.createNote()

        setNotes((prev) => [...prev, response])
    }

    async function createNewFolder(name: string): Promise<void> {
        const trimmed = capitalizeWords(name)
        if (!trimmed) return

        if (folders.some((f) => f.name?.toLowerCase() === trimmed.toLowerCase())) {
            setIsCreateFolderActive(false)
            return
        }

        const response: Folder = await window.notesApi.createFolder({
            id: folders.length + 1,
            name: trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
        })

        setFolders((prev) => [...prev, response])
        setIsCreateFolderActive(false)
    }

    async function renameFolder(name: string): Promise<void> {
        const trimmed = capitalizeWords(name)
        if (!trimmed) return

        if (folders.some((f) => f.name?.toLowerCase() === trimmed.toLowerCase())) {
            setIsRenameFolderActive(false)
            return
        }

        const response = await window.notesApi.updateFolder({ id: activeFolder.id, name: trimmed })

        setFolders((prev) =>
            prev.map((folder) =>
                folder.id === response.id ? { ...folder, name: response.name } : folder
            )
        )

        setIsRenameFolderActive(false)
        setActiveFolder({ id: response.id, name: response.name })
    }

    async function deleteFolder(): Promise<void> {
        await window.notesApi.deleteFolder(activeFolder)
        window.location.reload()
    }

    function getFolderNameFromId(id: number | undefined): string {
        const name = folders.find((folder) => folder.id === id)?.name
        return typeof name === 'string' ? name : ''
    }

    const stripHtml = (html: string): string => {
        const tmp = document.createElement('DIV')
        tmp.innerHTML = html
        return tmp.textContent + ' ' || tmp.innerText + ' ' || ' '
    }

    const foldersWithCounts = React.useMemo(() => {
        return folders
            .map((folder) => ({
                ...folder,
                noteCount: notes.filter((n) => n.folderId === folder.id).length
            }))
            .sort((a, b) => {
                if (b.noteCount !== a.noteCount) {
                    return b.noteCount - a.noteCount
                }

                return a.id - b.id
            })
    }, [folders, notes])

    return (
        <div
            className={`${isSidebarOpen ? 'w-64 md:w-72 lg:w-80' : 'w-16 md:w-18 items-center'} flex shrink-0 flex-col bg-light-foreground dark:bg-dark-foreground border-r border-light-border dark:border-dark-border transition-discrete duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden`}
        >
            {/* Active Database Section */}
            {isSidebarOpen && (
                <div className="flex gap-2 justify-start items-center px-2 border-b border-light-border dark:border-dark-border text-[10px] font-medium text-light-secondaryText dark:text-dark-secondaryText bg-light-surface dark:bg-dark-surface">
                    <Database className="w-3 shrink-0" />
                    <span
                        title={activeDatabase}
                        className={`cursor-default ${accentValue[activeAccent].selection}`}
                    >
                        {truncateActiveDatabasePath(activeDatabase, 40)}
                    </span>
                </div>
            )}

            {/* Header Section */}
            <div
                className={`flex ${isSidebarOpen ? 'flex-row justify-between' : 'flex-col gap-3 mt-1'} items-center shrink-0 p-2 cursor-default select-none`}
            >
                <div className={`flex flex-row items-center gap-2`} hidden={!isSidebarOpen}>
                    <span
                        className={`w-5 h-5 flex items-center justify-center text-white text-[14px] font-bold ${accentValue[activeAccent].bg}`}
                        style={{ borderRadius: '6px' }}
                    >
                        I
                    </span>
                    <div className="text-[16px] font-semibold tracking-tight text-light-primaryText dark:text-dark-primaryText">
                        {isTrashOpened ? 'Trash' : 'Indigo'}
                    </div>
                </div>
                <span
                    hidden={isSidebarOpen}
                    className={`w-7 h-7 p-1 rounded-lg flex items-center justify-center text-white text-lg font-bold ${accentValue[activeAccent].bg}`}
                >
                    I
                </span>
                <Button
                    title="Toggle Sidebar"
                    onClick={toggleSidebar}
                    className={`p-1 rounded-lg text-light-secondaryText dark:text-dark-secondaryText ${isSidebarOpen ? 'border-none' : 'border'} hover:brightness-80 dark:hover:brightness-120`}
                >
                    {isSidebarOpen ? (
                        <ChevronLeft className="h-4 w-4 hover:text-light-primaryText dark:hover:text-dark-primaryText" />
                    ) : (
                        <Menu className="h-5 w-5" />
                    )}
                </Button>
            </div>

            {/* Search Bar And Action Button */}
            {isSidebarOpen && (
                <div className="flex flex-col gap-3 p-2 shrink-0">
                    <div
                        className={`flex flex-row items-center gap-2 p-2 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-[#1c1c1e] text-light-secondaryText dark:text-dark-secondaryText`}
                    >
                        <Search className="h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`flex-1 border-none outline-none text text-xs text-light-primaryText dark:text-dark-primaryText ${accentValue[activeAccent].selection}`}
                        />
                        <button
                            title="Clear Search"
                            onClick={() => setSearchQuery('')}
                            hidden={searchQuery.trim().length === 0}
                        >
                            <X className="h-4 w-4 hover:text-light-primaryText dark:hover:text-dark-primaryText" />
                        </button>
                    </div>

                    <Button
                        title="Create A New Note"
                        hidden={isTrashOpened}
                        className={`flex flex-row items-center justify-center gap-1 text-white rounded-lg text-[14px] font-medium transition duration-300 ${accentValue[activeAccent].bg} ${accentValue[activeAccent].bgHover} hover:-translate-y-px`}
                        onClick={createNewNote}
                    >
                        <Plus className="mb-1 h-4 w-4" />
                        <span>New Note</span>
                    </Button>
                    <Button
                        title="Empty Trash"
                        hidden={!isTrashOpened}
                        className={`flex flex-row items-center justify-center gap-2 text-white rounded-lg text-[14px] font-medium transition duration-300 bg-red-500 hover:bg-red-600 hover:-translate-y-px`}
                    >
                        <Trash2 className="h-4 w-4 mb-1" />
                        <span>Empty Trash</span>
                    </Button>
                </div>
            )}

            {/* Folder Chips */}
            <div
                {...events}
                ref={folderChipRef}
                className={`flex row items-center gap-1 p-2 shrink-0 overflow-x-auto no-scrollbar select-none no-drag-cursor`}
                hidden={isTrashOpened || !isSidebarOpen}
            >
                <FolderChip
                    className={`${activeFolder.name === 'All' ? `${accentValue[activeAccent].border} ${accentValue[activeAccent].bgSubtle}` : accentValue[activeAccent].active}`}
                    onClick={() => setActiveFolder({ id: 0, name: 'All' })}
                >
                    <span
                        className={`${activeFolder.name === 'All' ? accentValue[activeAccent].text : null}`}
                    >
                        All
                    </span>
                    <span className="text-light-secondaryText dark:text-dark-secondaryText">
                        {notes.length}
                    </span>
                </FolderChip>

                <FolderChip
                    className={`${activeFolder.name === 'Favorites' ? `${accentValue[activeAccent].border} ${accentValue[activeAccent].bgSubtle}` : accentValue[activeAccent].active}`}
                    onClick={() => setActiveFolder({ id: 0, name: 'Favorites' })}
                >
                    <Heart
                        className={`h-3 w-3 opacity-70 ${activeFolder.name === 'Favorites' ? accentValue[activeAccent].text : null}`}
                        style={{
                            fill:
                                activeFolder.name === 'Favorites'
                                    ? accentValue[activeAccent].hex
                                    : undefined
                        }}
                    />
                    <span
                        className={`${activeFolder.name === 'Favorites' ? accentValue[activeAccent].text : null}`}
                    >
                        Favorites
                    </span>
                    <span className="text-light-secondaryText dark:text-dark-secondaryText">
                        {notes.filter((note) => note.isFavourite === true).length | 0}
                    </span>
                </FolderChip>

                <div
                    hidden={folders.length < 1}
                    className={`w-px h-5 mx-1 shrink-0 bg-gray-300 dark:bg-gray-600`}
                />

                {foldersWithCounts.map((folder) => (
                    <FolderChip
                        key={folder.id}
                        className={`${activeFolder.name === folder.name ? `${accentValue[activeAccent].border} ${accentValue[activeAccent].bgSubtle}` : accentValue[activeAccent].active} min-w-max no-drag-cursor`}
                        onClick={() =>
                            folder.name && setActiveFolder({ id: folder.id, name: folder.name })
                        }
                    >
                        <span
                            className={`${activeFolder.name === folder.name ? accentValue[activeAccent].text : null}`}
                        >
                            {folder.name}
                        </span>
                        <span className="text-light-secondaryText dark:text-dark-secondaryText">
                            {folder.noteCount}
                        </span>
                    </FolderChip>
                ))}

                {!isCreateFolderActive ? (
                    <Button
                        onClick={() => setIsCreateFolderActive((prev) => !prev)}
                        title="Create New Folder"
                        className={`flex items-center py-1.5 rounded-lg text-light-secondaryText! dark:text-dark-primaryText! cursor-default no-drag-cursor bg-white dark:bg-[#1c1c1e] ${accentValue[activeAccent].active} no-drag-cursor`}
                    >
                        <Plus className="h-4.5 w-4 no-drag-cursor" />
                    </Button>
                ) : (
                    <input
                        className={`flex-1 border py-1.5 px-1 rounded-lg w-24 border-light-border dark:border-dark-border outline-none text text-xs text-light-primaryText dark:text-dark-primaryText bg-white dark:bg-[#1c1c1e] capitalize no-drag-cursor`}
                        autoFocus
                        placeholder="Name..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                e.currentTarget.blur()
                            }

                            if (e.key === 'Escape') {
                                e.preventDefault()
                                setIsCreateFolderActive(false)
                            }
                        }}
                        onBlur={(e) => {
                            createNewFolder(e.currentTarget.value)
                            setIsCreateFolderActive(false)
                            folderChipRef.current.scrollTo({
                                left:
                                    folderChipRef.current.scrollWidth -
                                    folderChipRef.current.clientWidth +
                                    50,
                                behavior: 'smooth'
                            })
                        }}
                    />
                )}
            </div>

            {/* Current Folder Header Bar */}
            <div
                className={`flex row items-center justify-between mt-2 px-2 py-1 h-8 gap-8 shrink-0 border-t border-b border-light-border dark:border-dark-border`}
                hidden={!isSidebarOpen}
            >
                <input
                    ref={(el) => {
                        if (el) el.focus()
                    }}
                    hidden={!isRenameFolderActive}
                    className={`flex-1 py-1.5 px-1 rounded-lg w-24 outline-none text capitalize no-drag-cursor tracking-wide text-light-secondaryText dark:text-dark-secondaryText text-[11px] font-medium`}
                    autoFocus
                    placeholder="New Folder Name..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            e.currentTarget.blur()
                        }

                        if (e.key === 'Escape') {
                            e.preventDefault()
                            setIsRenameFolderActive(false)
                            e.currentTarget.value = ''
                        }
                    }}
                    onBlur={(e) => {
                        renameFolder(e.currentTarget.value)
                        setIsRenameFolderActive(false)
                        e.currentTarget.value = ''
                    }}
                />
                <span
                    hidden={isRenameFolderActive}
                    className="truncate tracking-wide text-light-secondaryText dark:text-dark-secondaryText text-[11px] font-medium"
                >
                    {isTrashOpened
                        ? 'Deleted'
                        : activeFolder.name === 'All'
                          ? 'All Notes'
                          : activeFolder.name}
                </span>
                {activeFolder.name !== 'All' &&
                activeFolder.name !== 'Favorites' &&
                !isTrashOpened ? (
                    <PopoverComponent
                        title="Folder Options"
                        buttonClassName="cursor-default"
                        anchor="bottom end"
                        panelClassName="min-w-32 border border-light-border dark:border-dark-border rounded-lg p-1 flex flex-col gap-1"
                        trigger={
                            <MoreHorizontal
                                className={`w-4 h-5 shrink-0 text-light-secondaryText dark:text-dark-secondaryText hover:text-light-primaryText dark:hover:text-dark-primaryText`}
                            />
                        }
                    >
                        <button
                            title="Rename Folder"
                            className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 text-light-primaryText dark:text-dark-primaryText ${accentValue[activeAccent].hover} rounded-lg outline-none`}
                            onClick={() => setIsRenameFolderActive(true)}
                        >
                            <div>
                                <Edit2 className="w-3.5 h-3.5" />
                            </div>
                            <span>Rename</span>
                        </button>
                        <button
                            title="Delete Folder"
                            onClick={() => setIsDeleteFolderDialogActive(true)}
                            className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-400/10 rounded-lg outline-none`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                        </button>
                    </PopoverComponent>
                ) : null}

                <DialogComponent
                    open={isDeleteFolderDialogActive}
                    onClose={() => setIsDeleteFolderDialogActive(false)}
                    className="flex flex-col items-center text-center w-96 bg-light-foreground dark:bg-dark-foreground border border-light-border dark:border-dark-border rounded-lg"
                    titleClassName="text-light-primaryText dark:text-dark-primaryText"
                    descriptionClassName="text-light-secondaryText dark:text-dark-secondaryText"
                    title={`Delete '${activeFolder.name}' Folder ?`}
                    description="The folder will be removed, and any notes it contains will be moved to 'All Notes'"
                    icon={
                        <div className="p-3 rounded-full bg-red-100 text-red-500 dark:bg-red-400/10">
                            <AlertTriangle className="w-8 h-8" strokeWidth={1.5} />
                        </div>
                    }
                >
                    <div className="flex flex-row items-center justify-between gap-2 text-center font-medium w-full">
                        <Button
                            onClick={() => setIsDeleteFolderDialogActive(false)}
                            className="w-1/2 rounded-lg bg-light-surface dark:bg-dark-surface text-light-primaryText dark:text-dark-primaryText transition duration-300 hover:-translate-y-px"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="w-1/2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition duration-300 hover:-translate-y-px"
                            onClick={() => deleteFolder()}
                        >
                            Delete Folder
                        </Button>
                    </div>
                </DialogComponent>
            </div>

            {/* Notes List Section */}
            <div className={`flex-1 min-h-0`}>
                <div
                    className={`h-full overflow-y-auto px-2 text-light-secondaryText dark:text-dark-secondaryText flex flex-col gap-1 py-2 select-none group`}
                    hidden={!isSidebarOpen}
                >
                    {notes.map((note) => (
                        <div
                            key={note.id}
                            className={`flex flex-col p-2 gap-0.5 rounded-lg min-h-24 max-h-min-h-24 text-light-primaryText dark:text-dark-primaryText ${accentValue[activeAccent].hover}`}
                        >
                            <div className={`flex justify-start items-center font-[450] text-sm`}>
                                <ChevronRight
                                    className={`h-4 w-min shrink-0 -mt-0.5 hidden`}
                                    strokeWidth={2.5}
                                />
                                <span className={`truncate`}>{note.title}</span>
                            </div>
                            <span
                                className={`text-[12px] line-clamp-2 leading-4 font-normal text-light-secondaryText dark:text-dark-secondaryText`}
                            >
                                {note.body
                                    ? stripHtml(note.body) +
                                      "Don't forget the organic honey and the specific brand of oat milk."
                                    : 'No additional text'}
                            </span>
                            <div className={`flex flex-row justify-between mt-2 items-center`}>
                                {note.lastModified && (
                                    <span
                                        className={`text-[10px] font-normal text-light-tertiaryText dark:text-dark-tertiaryText`}
                                    >
                                        <ReactTimeAgo
                                            date={new Date(note.lastModified)}
                                            locale="en"
                                        />
                                    </span>
                                )}
                                {(activeFolder.name === 'All' ||
                                    activeFolder.name === 'Favorites') &&
                                    getFolderNameFromId(note.folderId) && (
                                        <span
                                            className={`text-[9px] px-1.5 py-0.5 rounded-md truncate max-w-40 text-light-tertiaryText dark:text-dark-tertiaryText bg-slate-100 dark:bg-white/5`}
                                        >
                                            {getFolderNameFromId(note.folderId)}
                                        </span>
                                    )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer Section */}
            <div
                className={`px-2 py-3 flex ${isSidebarOpen ? 'flex-row justify-between' : 'flex-col-reverse gap-4'} items-center shrink-0 border-t w-full border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface`}
            >
                <span
                    className={`text-xs font-normal opacity-50 text-light-secondaryText dark:text-dark-secondaryText select-none`}
                >
                    v1.0
                </span>
                <div
                    className={`flex ${isSidebarOpen ? 'flex-row' : 'flex-col'} gap-2 text-light-secondaryText dark:text-dark-secondaryText`}
                >
                    <Button
                        title="Toggle Trash"
                        onClick={() => {
                            setIsTrashOpened((prev) => !prev)
                            if (!isSidebarOpen) toggleSidebar()
                        }}
                        className={`p-2 border-none ${isTrashOpened ? accentValue[activeAccent].bgSubtle : null} hover:text-light-primaryText dark:hover:text-dark-primaryText transition-transform active:scale-95 hover:scale-110 shrink-0`}
                    >
                        <Trash2 className={`h-4 w-4 ${isTrashOpened ? 'hidden' : null}`} />
                        <Archive className={`h-4 w-4 ${!isTrashOpened ? 'hidden' : null}`} />
                    </Button>

                    <PopoverComponent
                        title="App Acccent Picker"
                        buttonClassName="cursor-default"
                        panelClassName="p-2 min-w-32 border border-light-border dark:border-dark-border rounded-lg grid grid-cols-3 gap-2"
                        anchor={isSidebarOpen ? 'top start' : 'right'}
                        trigger={
                            <Button
                                className={`p-2 border-none hover:text-light-primaryText dark:hover:text-dark-primaryText transition-transform active:scale-95 hover:scale-110 shrink-0`}
                            >
                                <Palette className="h-4 w-4" />
                            </Button>
                        }
                    >
                        {accents.map((accent) => (
                            <button
                                title={capitalizeWords(accent)}
                                key={accent}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95 hover:scale-110 shrink-0`}
                                style={{ background: accentValue[accent].hex }}
                                onClick={() => changeActiveAccent(accent)}
                            >
                                {activeAccent === accent && (
                                    <Check
                                        className="w-4 h-4 text-white drop-shadow-md"
                                        strokeWidth={3}
                                    />
                                )}
                            </button>
                        ))}
                    </PopoverComponent>

                    <PopoverComponent
                        title="Light/Dark Theme Switcher"
                        buttonClassName="cursor-default"
                        anchor={isSidebarOpen ? 'top start' : 'right'}
                        panelClassName="min-w-32 border border-light-border dark:border-dark-border rounded-lg p-1 flex flex-col gap-1"
                        trigger={
                            <Button
                                className={`p-2 border-none hover:text-light-primaryText dark:hover:text-dark-primaryText transition-transform active:scale-95 hover:scale-110 shrink-0`}
                            >
                                <Sun
                                    className={`h-4 w-4 flex items-center justify-center ${activeTheme !== 'light' ? 'hidden' : null}`}
                                />
                                <Moon
                                    className={`h-4 w-4 flex items-center justify-center ${activeTheme !== 'dark' ? 'hidden' : null}`}
                                />
                                <Monitor
                                    className={`h-4 w-4 flex items-center justify-center ${activeTheme !== 'system' ? 'hidden' : null}`}
                                />
                            </Button>
                        }
                    >
                        {themes.map((theme) => (
                            <button
                                key={theme}
                                className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 ${activeTheme === theme && accentValue[activeAccent].bgSubtle} ${activeTheme === theme ? accentValue[activeAccent].text : 'text-light-primaryText dark:text-dark-primaryText'} ${accentValue[activeAccent].hover} rounded-lg outline-none`}
                                onClick={() => changeActiveTheme(theme)}
                            >
                                {theme === 'light' && <Sun className="w-4 h-4" />}
                                {theme === 'dark' && <Moon className="w-4 h-4" />}
                                {theme === 'system' && <Monitor className="w-4 h-4" />}
                                {capitalizeWords(theme)}
                            </button>
                        ))}
                    </PopoverComponent>
                </div>
            </div>
        </div>
    )
}
