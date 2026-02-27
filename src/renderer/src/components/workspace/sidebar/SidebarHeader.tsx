import PopoverComponent from '@renderer/components/ui/PopOver'
import {
    AlertTriangle,
    Database,
    FilePlus,
    FolderOpen,
    LogOut,
    Menu,
    MoreHorizontal,
    PanelLeftClose,
    Plus,
    Search,
    Trash2,
    X
} from 'lucide-react'
import React, { useState } from 'react'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import { Note, Notes } from 'src/shared/model/note'
import { truncateActiveDatabasePath } from 'src/shared/util/stringUtils'
import Button from '../../ui/Button'
import { DialogComponent } from '../../ui/DialogComponent'

type SidebarHeaderProps = {
    isSidebarOpen: boolean
    toggleSidebar: () => void
    activeDatabase: string
    activeAccent: Accent
    isTrashOpened: boolean
    searchQuery: string
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>
    createNewNote: () => Promise<void>
    notes: Notes
    reloadAllNotes: () => Promise<void>
    setActiveNote: React.Dispatch<React.SetStateAction<Note | undefined>>
}

export default function SidebarHeader({
    isSidebarOpen,
    toggleSidebar,
    activeDatabase,
    activeAccent,
    isTrashOpened,
    searchQuery,
    setSearchQuery,
    createNewNote,
    notes,
    reloadAllNotes,
    setActiveNote
}: SidebarHeaderProps): React.JSX.Element {
    const [isEmptyTrashDialogActive, setIsEmptyTrashDialogActive] = useState(false)

    const isTrashEmpty = !notes.some((note) => note.isInTrash)

    async function emptyTrash(): Promise<void> {
        await window.notesApi.deleteAllNoteInTrash()
        await reloadAllNotes()
        setIsEmptyTrashDialogActive(false)
        setActiveNote(undefined)
    }

    async function createNew(): Promise<void> {
        try {
            await window.databaseApi.createDatabase()
        } catch (error) {
            console.error(error)
        }
    }

    async function openExisting(): Promise<void> {
        try {
            await window.databaseApi.loadDatabase()
        } catch (error) {
            console.error(error)
        }
    }

    async function closeActiveCollection(): Promise<void> {
        try {
            await window.databaseApi.deleteActiveDatabasePath()
        } catch (error) {
            console.error(error)
        }
    }

    return (
        <>
            {isSidebarOpen && (
                <div className="group flex gap-2 justify-between items-center px-2 border-b border-light-border dark:border-dark-border text-[10px] font-medium text-light-secondaryText dark:text-dark-secondaryText bg-light-surface dark:bg-dark-surface">
                    <div className="flex gap-2 justify-start items-center">
                        <Database className="w-3 shrink-0" />
                        <span
                            title={activeDatabase}
                            className={`cursor-default ${accentValue[activeAccent].selection} truncate`}
                        >
                            {truncateActiveDatabasePath(activeDatabase, 40)}
                        </span>
                    </div>
                    <PopoverComponent
                        title="Folder Options"
                        buttonClassName="cursor-default"
                        anchor="bottom end"
                        panelClassName="min-w-32 border border-light-border dark:border-dark-border rounded-lg p-1 flex flex-col gap-1 select-none"
                        trigger={
                            <MoreHorizontal
                                className={`w-4 h-5 shrink-0 text-light-secondaryText dark:text-dark-secondaryText hover:text-light-primaryText dark:hover:text-dark-primaryText`}
                            />
                        }
                    >
                        <button
                            title="Create A New Indigo Collection"
                            onClick={() => createNew()}
                            className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 text-light-primaryText dark:text-dark-primaryText ${accentValue[activeAccent].hover} rounded-lg outline-none`}
                        >
                            <div>
                                <FilePlus className="w-3.5 h-3.5" />
                            </div>
                            <span>Create New Collection</span>
                        </button>
                        <button
                            title="Load From Existing .indigo Collection"
                            onClick={() => openExisting()}
                            className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 text-light-primaryText dark:text-dark-primaryText ${accentValue[activeAccent].hover} rounded-lg outline-none`}
                        >
                            <div>
                                <FolderOpen className="w-3.5 h-3.5" />
                            </div>
                            <span>Load From Collection</span>
                        </button>
                        <div className={`h-px my-1 mx-2 bg-light-border dark:bg-dark-border`} />
                        <button
                            title="Close Active Collection And Return To Landing Screen"
                            onClick={() => closeActiveCollection()}
                            className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-400/10 rounded-lg outline-none`}
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Close Active Collection</span>
                        </button>
                    </PopoverComponent>
                </div>
            )}

            <div
                className={`flex ${isSidebarOpen ? 'flex-row justify-between' : 'flex-col gap-3 mt-1'} items-center shrink-0 p-2 cursor-default select-none`}
            >
                <div className={`flex flex-row items-center gap-2`} hidden={!isSidebarOpen}>
                    <span
                        className={`w-5 h-5 flex items-center justify-center text-white text-[14px] font-black ${accentValue[activeAccent].bg}`}
                        style={{ borderRadius: '6px' }}
                    >
                        /
                    </span>
                    <div className="text-[16px] font-semibold tracking-tight text-light-primaryText dark:text-dark-primaryText">
                        {isTrashOpened ? 'Trash' : 'Indigo'}
                    </div>
                </div>
                <span
                    hidden={isSidebarOpen}
                    className={`w-7 h-7 p-1 rounded-lg flex items-center justify-center text-white text-lg font-black ${accentValue[activeAccent].bg}`}
                >
                    /
                </span>
                <Button
                    title="Toggle Sidebar"
                    onClick={toggleSidebar}
                    className={`${isSidebarOpen ? 'px-1' : 'p-1'} rounded-lg text-light-secondaryText dark:text-dark-secondaryText ${isSidebarOpen ? 'border-none' : 'border mt-1'} hover:brightness-80 dark:hover:brightness-120`}
                >
                    {isSidebarOpen ? (
                        <PanelLeftClose className="h-4 w-4 -mr-1 hover:text-light-primaryText dark:hover:text-dark-primaryText" />
                    ) : (
                        <Menu className="h-5 w-5" />
                    )}
                </Button>
            </div>

            {isSidebarOpen && (
                <div className="flex flex-col gap-3 p-2 pt-0 shrink-0">
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
                        hidden={isTrashOpened}
                        className={`flex flex-row items-center justify-center gap-1 text-white rounded-lg text-[14px] font-medium transition duration-300 ${accentValue[activeAccent].bg} ${accentValue[activeAccent].bgHover} hover:-translate-y-px select-none`}
                        onClick={createNewNote}
                    >
                        <Plus className="mb-1 h-4 w-4" />
                        <span>New Note</span>
                    </Button>
                    <Button
                        onClick={() => setIsEmptyTrashDialogActive(true)}
                        hidden={!isTrashOpened}
                        disabled={isTrashEmpty}
                        className={`flex flex-row items-center justify-center gap-2 text-white rounded-lg text-[14px] font-medium transition duration-300 ${isTrashEmpty ? 'disabled:bg-red-400' : 'bg-red-500 hover:bg-red-600 hover:-translate-y-px'} select-none`}
                    >
                        <Trash2 className="h-4 w-4 mb-1" />
                        <span>Empty Trash</span>
                    </Button>
                    <DialogComponent
                        open={isEmptyTrashDialogActive}
                        onClose={() => setIsEmptyTrashDialogActive(false)}
                        className="flex flex-col items-center text-center w-96 bg-light-foreground dark:bg-dark-foreground border border-light-border dark:border-dark-border rounded-lg"
                        titleClassName="text-light-primaryText dark:text-dark-primaryText"
                        descriptionClassName="text-light-secondaryText dark:text-dark-secondaryText"
                        title={`Empty Trash ?`}
                        description="All notes in the trash will be permanently deleted. This action cannot be undone"
                        icon={
                            <div className="p-3 rounded-full bg-red-100 text-red-500 dark:bg-red-400/10">
                                <AlertTriangle className="w-8 h-8" strokeWidth={1.5} />
                            </div>
                        }
                    >
                        <div className="flex flex-row items-center justify-between gap-2 text-center font-medium w-full">
                            <Button
                                onClick={() => setIsEmptyTrashDialogActive(false)}
                                className="w-1/2 rounded-lg bg-light-surface dark:bg-dark-surface text-light-primaryText dark:text-dark-primaryText transition duration-300 hover:-translate-y-px"
                            >
                                Cancel
                            </Button>
                            <Button
                                className="w-1/2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition duration-300 hover:-translate-y-px"
                                onClick={() => emptyTrash()}
                            >
                                Confirm
                            </Button>
                        </div>
                    </DialogComponent>
                </div>
            )}
        </>
    )
}
