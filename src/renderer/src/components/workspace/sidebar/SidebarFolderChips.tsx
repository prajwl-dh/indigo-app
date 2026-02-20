import { Heart, Plus } from 'lucide-react'
import React, { useState } from 'react'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import { Folder, Folders, Notes } from 'src/shared/model/note'
import { capitalizeWords } from 'src/shared/util/stringUtils'
import Button from '../../ui/Button'
import FolderChip from '../../ui/FolderChip'

type SidebarFolderChipsProps = {
    isTrashOpened: boolean
    isSidebarOpen: boolean
    folderChipRef: React.MutableRefObject<HTMLInputElement>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: any
    activeFolder: Folder
    setActiveFolder: React.Dispatch<React.SetStateAction<Folder>>
    activeAccent: Accent
    folders: Folders
    setFolders: React.Dispatch<React.SetStateAction<Folders>>
    searchedNotes: Notes
}

export default function SidebarFolderChips({
    isTrashOpened,
    isSidebarOpen,
    folderChipRef,
    events,
    activeFolder,
    setActiveFolder,
    activeAccent,
    folders,
    setFolders,
    searchedNotes
}: SidebarFolderChipsProps): React.JSX.Element | null {
    const [isCreateFolderActive, setIsCreateFolderActive] = useState(false)

    if (isTrashOpened || !isSidebarOpen) return null

    const foldersWithCounts = folders
        .map((folder) => ({
            ...folder,
            noteCount: searchedNotes.filter((n) => n.folderId === folder.id).length
        }))
        .sort((a, b) => {
            if (b.noteCount !== a.noteCount) return b.noteCount - a.noteCount
            return a.id - b.id
        })

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
        setActiveFolder({ id: response.id, name: response.name })
        setIsCreateFolderActive(false)
    }

    return (
        <div
            {...events}
            ref={folderChipRef as React.LegacyRef<HTMLDivElement>}
            className={`flex row items-center gap-1 p-2 shrink-0 overflow-x-auto no-scrollbar select-none no-drag-cursor`}
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
                    {searchedNotes.length}
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
                    {searchedNotes.filter((note) => note.isFavorite === true).length | 0}
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
    )
}
