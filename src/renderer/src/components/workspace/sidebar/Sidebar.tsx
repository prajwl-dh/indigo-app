import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import React from 'react'
import { useDraggable } from 'react-use-draggable-scroll'
import { Accent } from 'src/shared/model/accent'
import { Folder, Folders, Note, Notes } from 'src/shared/model/note'
import { Theme } from 'src/shared/model/theme'
import { normalizeNoSpace, stripHtml } from 'src/shared/util/stringUtils'

import SidebarCurrentFolder from './SidebarCurrentFolder'
import SidebarFolderChips from './SidebarFolderChips'
import SidebarFooter from './SidebarFooter'
import SidebarHeader from './SidebarHeader'
import SidebarNotesList from './SidebarNotesList'

TimeAgo.addDefaultLocale(en)

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
    activeNote: Note | undefined
    setActiveNote: React.Dispatch<React.SetStateAction<Note | undefined>>
    reloadAllNotes: () => Promise<void>
    reloadAllFolders: () => Promise<void>
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
    setFolders,
    activeNote,
    setActiveNote,
    reloadAllNotes,
    reloadAllFolders
}: SidebarType): React.JSX.Element {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(true)
    const [searchQuery, setSearchQuery] = React.useState<string>('')

    const folderChipRef = React.useRef<HTMLDivElement>(
        null
    ) as React.MutableRefObject<HTMLInputElement>
    const { events } = useDraggable(folderChipRef)

    function toggleSidebar(): void {
        setIsSidebarOpen((prev) => !prev)
    }

    async function createNewNote(): Promise<void> {
        const isFavorite = activeFolder.name === 'Favorites'
        const folderId = isFavorite || activeFolder.name === 'All' ? 0 : activeFolder.id
        const response = await window.notesApi.createNote(folderId, isFavorite)
        reloadAllNotes()
        setActiveNote(response)
    }

    const baseNotes = notes.filter((note) => (isTrashOpened ? note.isInTrash : !note.isInTrash))

    const searchedNotes = baseNotes.filter((note) => {
        const query = normalizeNoSpace(searchQuery)
        if (!query) return true

        const title = normalizeNoSpace((note.title || '').toLowerCase())
        const body = normalizeNoSpace(stripHtml(note.body || '').toLowerCase())

        return title.includes(query) || body.includes(query)
    })

    const filteredNotes = searchedNotes.filter((note) => {
        if (isTrashOpened) return true
        if (activeFolder.name === 'All') return true
        if (activeFolder.name === 'Favorites') return note.isFavorite
        return note.folderId === activeFolder.id
    })

    return (
        <div
            className={`${isSidebarOpen ? 'w-64 md:w-72 lg:w-80' : 'w-16 md:w-18 items-center'} flex shrink-0 flex-col bg-light-foreground dark:bg-dark-foreground border-r border-light-border dark:border-dark-border transition-discrete duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden z-30`}
        >
            <SidebarHeader
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
                activeDatabase={activeDatabase}
                activeAccent={activeAccent}
                isTrashOpened={isTrashOpened}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                createNewNote={createNewNote}
                notes={notes}
                reloadAllNotes={reloadAllNotes}
                setActiveNote={setActiveNote}
            />

            <SidebarFolderChips
                isTrashOpened={isTrashOpened}
                isSidebarOpen={isSidebarOpen}
                folderChipRef={folderChipRef}
                events={events}
                activeFolder={activeFolder}
                setActiveFolder={setActiveFolder}
                activeAccent={activeAccent}
                folders={folders}
                setFolders={setFolders}
                searchedNotes={searchedNotes}
            />

            <SidebarCurrentFolder
                isSidebarOpen={isSidebarOpen}
                activeFolder={activeFolder}
                setActiveFolder={setActiveFolder}
                isTrashOpened={isTrashOpened}
                searchedNotes={searchedNotes}
                activeAccent={activeAccent}
                folders={folders}
                setFolders={setFolders}
                reloadAllNotes={reloadAllNotes}
                reloadAllFolders={reloadAllFolders}
                folderChipRef={folderChipRef}
            />

            <SidebarNotesList
                filteredNotes={filteredNotes}
                isSidebarOpen={isSidebarOpen}
                searchQuery={searchQuery}
                isTrashOpened={isTrashOpened}
                activeAccent={activeAccent}
                activeNote={activeNote}
                setActiveNote={setActiveNote}
                folders={folders}
                reloadAllNotes={reloadAllNotes}
                setIsTrashOpened={setIsTrashOpened}
                setActiveFolder={setActiveFolder}
                activeFolder={activeFolder}
            />

            <SidebarFooter
                isSidebarOpen={isSidebarOpen}
                isTrashOpened={isTrashOpened}
                setIsTrashOpened={setIsTrashOpened}
                setActiveNote={setActiveNote}
                activeAccent={activeAccent}
                changeActiveAccent={changeActiveAccent}
                activeTheme={activeTheme}
                changeActiveTheme={changeActiveTheme}
            />
        </div>
    )
}
