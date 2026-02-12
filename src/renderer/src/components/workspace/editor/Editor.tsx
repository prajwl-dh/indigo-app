import React from 'react'
import { Accent } from 'src/shared/model/accent'
import { Note } from 'src/shared/model/note'
import EmptyPage from './EmptyPage'

type EditorType = {
    isTrashOpened: boolean
    setIsTrashOpened: React.Dispatch<React.SetStateAction<boolean>>
    activeNote: Note | undefined
    setActiveNote: React.Dispatch<React.SetStateAction<Note | undefined>>
    activeAccent: Accent
}

export default function Editor({
    isTrashOpened,
    setIsTrashOpened,
    activeNote,
    setActiveNote,
    activeAccent
}: EditorType): React.JSX.Element {
    if (!activeNote) {
        return (
            <EmptyPage
                isTrashOpened={isTrashOpened}
                setIsTrashOpened={setIsTrashOpened}
                activeNote={activeNote}
                setActiveNote={setActiveNote}
                activeAccent={activeAccent}
            />
        )
    }

    return (
        <div className="w-full h-full text-light-primaryText dark:text-dark-primaryText flex-1">
            Editor
        </div>
    )
}
