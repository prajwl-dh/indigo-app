import { AlertTriangle, Edit2, MoreHorizontal, Trash2 } from 'lucide-react'
import React, { useState } from 'react'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import { Folder, Folders, Notes } from 'src/shared/model/note'
import { capitalizeWords } from 'src/shared/util/stringUtils'
import Button from '../../ui/Button'
import { DialogComponent } from '../../ui/DialogComponent'
import PopoverComponent from '../../ui/PopOver'

type SidebarCurrentFolderProps = {
    isSidebarOpen: boolean
    activeFolder: Folder
    setActiveFolder: React.Dispatch<React.SetStateAction<Folder>>
    isTrashOpened: boolean
    searchedNotes: Notes
    activeAccent: Accent
    folders: Folders
    setFolders: React.Dispatch<React.SetStateAction<Folders>>
    reloadAllNotes: () => Promise<void>
    reloadAllFolders: () => Promise<void>
    folderChipRef: React.MutableRefObject<HTMLInputElement>
}

export default function SidebarCurrentFolder({
    isSidebarOpen,
    activeFolder,
    setActiveFolder,
    isTrashOpened,
    searchedNotes,
    activeAccent,
    folders,
    setFolders,
    reloadAllNotes,
    reloadAllFolders,
    folderChipRef
}: SidebarCurrentFolderProps): React.JSX.Element | null {
    const [isRenameFolderActive, setIsRenameFolderActive] = useState(false)
    const [isDeleteFolderDialogActive, setIsDeleteFolderDialogActive] = useState(false)

    if (!isSidebarOpen) return null

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
        setIsDeleteFolderDialogActive(false)
        await reloadAllNotes()
        await reloadAllFolders()
        setActiveFolder({ id: 0, name: 'All' })
        folderChipRef.current.scrollTo({ left: 0, behavior: 'smooth' })
    }

    return (
        <div
            className={`flex row items-center justify-between mt-2 px-2 py-1 h-8 gap-8 shrink-0 border-t border-b border-light-border dark:border-dark-border`}
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
                className="truncate tracking-wide text-light-secondaryText dark:text-dark-secondaryText text-[11px] font-medium select-none"
            >
                {isTrashOpened ? (
                    <>
                        Trash
                        <span className="ml-1 text-light-secondaryText dark:text-dark-secondaryText font-normal">
                            {searchedNotes.length}
                        </span>
                    </>
                ) : activeFolder.name === 'All' ? (
                    'All Notes'
                ) : (
                    activeFolder.name
                )}
            </span>

            {activeFolder.name !== 'All' && activeFolder.name !== 'Favorites' && !isTrashOpened ? (
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
                className="flex flex-col items-center text-center w-96 bg-light-foreground dark:bg-dark-foreground border border-light-border dark:border-dark-border rounded-lg select-none"
                titleClassName="text-light-primaryText dark:text-dark-primaryText"
                descriptionClassName="text-light-secondaryText dark:text-dark-secondaryText"
                title={`Delete Folder '${activeFolder.name}' ?`}
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
    )
}
