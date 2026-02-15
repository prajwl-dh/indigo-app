import NoteOptionsComponent from '@renderer/components/ui/NoteOptionsComponent'
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import React from 'react'
import ReactTimeAgo from 'react-time-ago'
import { Accent } from 'src/shared/model/accent'
import { Folders, Note, Notes } from 'src/shared/model/note'
import EmptyPage from './EmptyPage'
TimeAgo.addDefaultLocale(en)

type EditorType = {
    isTrashOpened: boolean
    setIsTrashOpened: React.Dispatch<React.SetStateAction<boolean>>
    activeNote: Note | undefined
    setActiveNote: React.Dispatch<React.SetStateAction<Note | undefined>>
    activeAccent: Accent
    notes: Notes
    folders: Folders
    reloadAllNotes: () => Promise<void>
}

export default function Editor({
    isTrashOpened,
    setIsTrashOpened,
    activeNote,
    setActiveNote,
    activeAccent,
    notes,
    folders,
    reloadAllNotes
}: EditorType): React.JSX.Element {
    if (!activeNote) {
        return (
            <EmptyPage
                isTrashOpened={isTrashOpened}
                setIsTrashOpened={setIsTrashOpened}
                activeNote={activeNote}
                setActiveNote={setActiveNote}
                activeAccent={activeAccent}
                notes={notes}
            />
        )
    }

    return (
        <div className="w-full h-full text-light-primaryText dark:text-dark-primaryText flex-1">
            <div className={`flex flex-row items-center gap-4 justify-end px-6`}>
                <div className={`flex flex-row items-center gap-2`}>
                    <span
                        className={`text-[10px] font-medium uppercase tracking-wider text-light-secondaryText dark:text-dark-tertext-light-secondaryText`}
                    >
                        {isTrashOpened ? 'Trashed: ' : 'Last Edited: '}
                    </span>
                    <span
                        className={`text-[11px] font-medium text-light-primaryText dark:text-dark-primaryText`}
                    >
                        <ReactTimeAgo date={new Date(activeNote.lastModified)} locale="en" />
                    </span>
                </div>
                <NoteOptionsComponent
                    activeAccent={activeAccent}
                    activeNote={activeNote}
                    folders={folders}
                    isTrashOpened={isTrashOpened}
                    note={activeNote}
                    reloadAllNotes={reloadAllNotes}
                    setActiveNote={setActiveNote}
                    setIsTrashOpened={setIsTrashOpened}
                    anchor="top end"
                />
            </div>
            <div className="px-12">{activeNote.title}</div>
        </div>
    )
}
