import { PopoverButton } from '@headlessui/react'
import {
    AlertTriangle,
    Check,
    Copy,
    Folder,
    Heart,
    MoreHorizontal,
    RotateCcw,
    Search,
    Trash2,
    X
} from 'lucide-react'
import React from 'react'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import { Folders, Note } from 'src/shared/model/note'
import { normalizeNoSpace } from 'src/shared/util/stringUtils'
import Button from '../ui/Button'
import { DialogComponent } from './DialogComponent'
import PopoverComponent from './PopOver'

type Anchor =
    | 'bottom'
    | 'bottom start'
    | 'bottom end'
    | 'top'
    | 'top start'
    | 'top end'
    | 'left'
    | 'left start'
    | 'left end'
    | 'right'
    | 'right start'
    | 'right end'

type NoteOptionsComponentProps = {
    activeAccent: Accent
    folders: Folders
    note: Note
    reloadAllNotes: () => Promise<void>
    activeNote: Note | undefined
    setActiveNote: React.Dispatch<React.SetStateAction<Note | undefined>>
    isTrashOpened: boolean
    setIsTrashOpened: React.Dispatch<React.SetStateAction<boolean>>
    anchor: Anchor
}

export default function NoteOptionsComponent({
    activeAccent,
    folders,
    note,
    reloadAllNotes,
    activeNote,
    setActiveNote,
    isTrashOpened,
    setIsTrashOpened,
    anchor
}: NoteOptionsComponentProps): React.JSX.Element {
    const [moveToFolderSearchQuery, setMoveToFolderSearchQuery] = React.useState<string>('')
    const [isPermanentlyDeleteNoteDialogActive, setIsPermanentlyDeleteNoteDialogActive] =
        React.useState<boolean>(false)

    const sortedFolders = [
        ...folders.filter((folder) => folder.id === note.folderId),
        ...folders.filter((folder) => folder.id !== note.folderId)
    ]

    const filteredFolder = sortedFolders.filter((folder) => {
        const query = normalizeNoSpace(moveToFolderSearchQuery)
        if (!query) return true

        const folderName = normalizeNoSpace((folder.name || '').toLowerCase())

        return folderName.includes(query)
    })

    async function favoriteOrUnfavoriteNote(): Promise<void> {
        const updatedNote = await window.notesApi.updateNote({
            ...note,
            isFavorite: !note.isFavorite
        })
        await reloadAllNotes()
        setActiveNote(updatedNote)
    }

    async function duplicateANote(): Promise<void> {
        const newNote = await window.notesApi.createNote(0, false)

        const updatedNote = await window.notesApi.updateNote({
            ...newNote,
            title: 'Copy ' + note.title,
            body: note.body,
            isFavorite: note.isFavorite,
            folderId: note.folderId,
            isInTrash: note.isInTrash
        })

        await reloadAllNotes()
        setActiveNote(updatedNote)
    }

    async function moveNoteToADifferentFolder(newFolderId: number): Promise<void> {
        if (note.folderId === newFolderId) return

        const updatedNote = await window.notesApi.updateNote({ ...note, folderId: newFolderId })
        await reloadAllNotes()
        setActiveNote(updatedNote)
    }

    async function moveToTrash(): Promise<void> {
        await window.notesApi.updateNote({
            ...note,
            isInTrash: true,
            folderId: 0,
            isFavorite: false
        })
        await reloadAllNotes()
        setActiveNote(undefined)
    }

    async function restoreNote(): Promise<void> {
        const restoredNote = await window.notesApi.updateNote({
            ...note,
            isInTrash: false
        })
        await reloadAllNotes()
        setIsTrashOpened(false)
        setActiveNote(restoredNote)
    }

    async function permanentlyDeleteANote(): Promise<void> {
        await window.notesApi.deleteNote(note)
        await reloadAllNotes()
        setActiveNote(undefined)
    }

    return (
        <>
            <PopoverComponent
                title="Options"
                buttonClassName="cursor-default"
                anchor={anchor}
                panelClassName="w-48 border border-light-border dark:border-dark-border rounded-lg p-1 flex flex-col gap-1"
                trigger={
                    <MoreHorizontal
                        onClick={() => setActiveNote(note)}
                        className={`w-4 h-5 shrink-0 text-light-secondaryText dark:text-dark-secondaryText hover:text-light-primaryText dark:hover:text-dark-primaryText ${activeNote?.id !== note.id && 'opacity-0 group-hover:opacity-100'}`}
                    />
                }
            >
                <PopoverButton
                    hidden={isTrashOpened}
                    title={note.isFavorite ? 'Unfavorite note' : 'Favorite note'}
                    onClick={() => favoriteOrUnfavoriteNote()}
                    className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 text-light-primaryText dark:text-dark-primaryText ${accentValue[activeAccent].hover} rounded-lg outline-none`}
                >
                    <div className={`${note.isFavorite && accentValue[activeAccent].text}`}>
                        <Heart
                            className="w-3.5 h-3.5"
                            style={{
                                fill: note.isFavorite ? accentValue[activeAccent].hex : undefined
                            }}
                        />
                    </div>
                    <span>{note.isFavorite ? 'Unfavorite' : 'Favorite'}</span>
                </PopoverButton>
                <PopoverButton
                    hidden={isTrashOpened}
                    title="Duplicate Note"
                    onClick={() => duplicateANote()}
                    className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 text-light-primaryText dark:text-dark-primaryText ${accentValue[activeAccent].hover} rounded-lg outline-none`}
                >
                    <div>
                        <Copy className="w-3.5 h-3.5" />
                    </div>
                    <span>Duplicate</span>
                </PopoverButton>
                <div
                    className={`h-px my-1 mx-2 bg-light-border dark:bg-dark-border`}
                    hidden={isTrashOpened || filteredFolder.length < 1}
                />
                <div
                    className={`px-3 -mt-1 flex flex-col gap-1`}
                    hidden={isTrashOpened || filteredFolder.length < 1}
                >
                    <span className="text-light-tertiaryText dark:text-dark-tertiaryText text-[10px] uppercase font-medium tracking-wider">
                        Move To
                    </span>
                    <div className="flex flex-col max-h-32 overflow-x-hidden">
                        <div
                            className={`flex flex-row items-center justify-between p-1 gap-1 border border-light-border dark:border-dark-border rounded-lg bg-light-background dark:bg-dark-surface text-light-secondaryText dark:text-dark-secondaryText`}
                        >
                            <Search className="h-3 w-3 shrink-0 hover:text-light-primaryText dark:hover:text-dark-primaryText" />
                            <input
                                type="text"
                                placeholder="Search Folder"
                                value={moveToFolderSearchQuery}
                                onChange={(e) => setMoveToFolderSearchQuery(e.target.value)}
                                className={`w-full border-none outline-none text text-xs text-light-primaryText dark:text-dark-primaryText ${accentValue[activeAccent].selection}`}
                            />
                            <button
                                title="Clear Search"
                                onClick={() => setMoveToFolderSearchQuery('')}
                                hidden={moveToFolderSearchQuery.trim().length === 0}
                            >
                                <X className="h-3 w-3 shrink-0 hover:text-light-primaryText dark:hover:text-dark-primaryText" />
                            </button>
                        </div>
                        <div className={`flex flex-col overflow-y-scroll`}>
                            <div
                                className="text-light-secondaryText dark:text-dark-secondaryText px-2 pt-4 text-center text-xs select-none"
                                hidden={filteredFolder.length > 0}
                            >
                                No matching folder
                            </div>
                            {filteredFolder.map((folder) => (
                                <PopoverButton
                                    title={folder.name}
                                    key={folder.id}
                                    className={`w-full px-3 mt-1 py-1 text-[13px] flex items-center justify-between ${accentValue[activeAccent].hover} rounded-lg outline-none ${note.folderId === folder.id ? `${accentValue[activeAccent].text}` : `text-light-primaryText dark:text-dark-primaryText`}`}
                                    onClick={() => moveNoteToADifferentFolder(folder.id)}
                                >
                                    <div className="flex items-center gap-2.5 truncate">
                                        <div>
                                            <Folder className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="truncate">{folder.name}</span>
                                    </div>
                                    <Check
                                        className={`w-3.5 h-3.5 ${note.folderId !== folder.id && 'hidden'}`}
                                    />
                                </PopoverButton>
                            ))}
                        </div>
                    </div>
                </div>
                <div
                    className={`h-px my-1 mx-2 bg-light-border dark:bg-dark-border`}
                    hidden={isTrashOpened}
                />
                <PopoverButton
                    hidden={isTrashOpened}
                    title="Move note to trash"
                    onClick={() => moveToTrash()}
                    className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-400/10 rounded-lg outline-none`}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Move To Trash</span>
                </PopoverButton>
                <PopoverButton
                    hidden={!isTrashOpened}
                    title="Restore This Note"
                    onClick={() => restoreNote()}
                    className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 text-light-primaryText dark:text-dark-primaryText ${accentValue[activeAccent].hover} rounded-lg outline-none`}
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                </PopoverButton>
                <PopoverButton
                    hidden={!isTrashOpened}
                    title="Permanently Delete This Note"
                    onClick={() => setIsPermanentlyDeleteNoteDialogActive(true)}
                    className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-400/10 rounded-lg outline-none`}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                </PopoverButton>
            </PopoverComponent>
            <DialogComponent
                open={isPermanentlyDeleteNoteDialogActive}
                onClose={() => setIsPermanentlyDeleteNoteDialogActive(false)}
                className="flex flex-col items-center text-center w-96 bg-light-foreground dark:bg-dark-foreground border border-light-border dark:border-dark-border rounded-lg"
                titleClassName="text-light-primaryText dark:text-dark-primaryText"
                descriptionClassName="text-light-secondaryText dark:text-dark-secondaryText"
                title={`Delete Note?`}
                description="This note will be deleted permanently. This action can not be undone"
                icon={
                    <div className="p-3 rounded-full bg-red-100 text-red-500 dark:bg-red-400/10">
                        <AlertTriangle className="w-8 h-8" strokeWidth={1.5} />
                    </div>
                }
            >
                <div className="flex flex-row items-center justify-between gap-2 text-center font-medium w-full">
                    <Button
                        onClick={() => setIsPermanentlyDeleteNoteDialogActive(false)}
                        className="w-1/2 rounded-lg bg-light-surface dark:bg-dark-surface text-light-primaryText dark:text-dark-primaryText transition duration-300 hover:-translate-y-px"
                    >
                        Cancel
                    </Button>
                    <Button
                        className="w-1/2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition duration-300 hover:-translate-y-px"
                        onClick={() => permanentlyDeleteANote()}
                    >
                        Confirm
                    </Button>
                </div>
            </DialogComponent>
        </>
    )
}
