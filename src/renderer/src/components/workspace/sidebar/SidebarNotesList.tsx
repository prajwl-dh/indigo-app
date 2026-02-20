import NoteOptionsComponent from '@renderer/components/ui/NoteOptionsComponent'
import React from 'react'
import ReactTimeAgo from 'react-time-ago'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import { Folder, Folders, Note, Notes } from 'src/shared/model/note'
import { stripHtml } from 'src/shared/util/stringUtils'

type SidebarNotesListProps = {
    filteredNotes: Notes
    isSidebarOpen: boolean
    searchQuery: string
    isTrashOpened: boolean
    activeAccent: Accent
    activeNote: Note | undefined
    setActiveNote: React.Dispatch<React.SetStateAction<Note | undefined>>
    folders: Folders
    reloadAllNotes: () => Promise<void>
    setIsTrashOpened: React.Dispatch<React.SetStateAction<boolean>>
    setActiveFolder: React.Dispatch<React.SetStateAction<Folder>>
    activeFolder: Folder
}

export default function SidebarNotesList({
    filteredNotes,
    isSidebarOpen,
    searchQuery,
    isTrashOpened,
    activeAccent,
    activeNote,
    setActiveNote,
    folders,
    reloadAllNotes,
    setIsTrashOpened,
    setActiveFolder,
    activeFolder
}: SidebarNotesListProps): React.JSX.Element | null {
    function getFolderNameFromId(id: number | undefined): string {
        const name = folders.find((folder) => folder.id === id)?.name
        return typeof name === 'string' ? name : ''
    }

    return (
        <div className={`flex-1 min-h-0`}>
            {filteredNotes.length < 1 ? (
                <div
                    className={`h-full overflow-y-auto text-light-secondaryText dark:text-dark-secondaryText px-5 py-8 text-center text-xs select-none`}
                    hidden={!isSidebarOpen}
                >
                    {searchQuery.trim().length > 0
                        ? 'No notes match your search'
                        : isTrashOpened
                          ? 'No notes in trash'
                          : 'No notes yet'}
                </div>
            ) : (
                <div
                    className={`h-full overflow-y-auto px-2 text-light-secondaryText dark:text-dark-secondaryText flex flex-col gap-1 py-2 select-none`}
                    hidden={!isSidebarOpen}
                >
                    {filteredNotes.map((note) => (
                        <div
                            key={note.id}
                            className={`group flex flex-col justify-between p-2 gap-0.5 rounded-lg min-h-26 max-h-28 text-light-primaryText dark:text-dark-primaryText ${accentValue[activeAccent].hover} ${activeNote && activeNote.id === note.id && accentValue[activeAccent].bgSubtle}`}
                            onClick={() => setActiveNote(note)}
                        >
                            <div className="flex flex-row justify-between items-center gap-1">
                                <div
                                    className={`flex items-center gap-0 font-[440] text-sm transition-transform duration-200 truncate ${
                                        activeNote?.id === note.id && accentValue[activeAccent].text
                                    }`}
                                >
                                    <span className="truncate">
                                        {note.title || 'Untitled Note'}
                                    </span>
                                </div>
                                <NoteOptionsComponent
                                    activeAccent={activeAccent}
                                    folders={folders}
                                    note={note}
                                    reloadAllNotes={reloadAllNotes}
                                    activeNote={activeNote}
                                    setActiveNote={setActiveNote}
                                    isTrashOpened={isTrashOpened}
                                    setIsTrashOpened={setIsTrashOpened}
                                    anchor="bottom end"
                                    setActiveFolder={setActiveFolder}
                                />
                            </div>

                            <span
                                className={`text-[12px] mt-[0.5px] line-clamp-2 leading-4 font-normal text-light-secondaryText dark:text-dark-secondaryText`}
                            >
                                {note.body ? stripHtml(note.body) : 'No additional text'}
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
                                <div className="flex flex-row items-center gap-1">
                                    {activeFolder.name !== 'Favorites' && note.isFavorite && (
                                        <span
                                            className={`text-[9px] px-1.5 py-0.5 rounded-md truncate max-w-40 text-light-secondaryText dark:text-dark-secondaryText bg-slate-100 dark:bg-white/5`}
                                        >
                                            Favorites
                                        </span>
                                    )}
                                    {(activeFolder.name === 'All' ||
                                        activeFolder.name === 'Favorites') &&
                                        getFolderNameFromId(note.folderId) && (
                                            <span
                                                className={`text-[9px] px-1.5 py-0.5 rounded-md truncate max-w-20 text-light-secondaryText dark:text-dark-secondaryText bg-slate-100 dark:bg-white/5`}
                                            >
                                                {getFolderNameFromId(note.folderId)}
                                            </span>
                                        )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
