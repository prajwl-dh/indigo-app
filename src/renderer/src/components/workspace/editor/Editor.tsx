import React from 'react'
import { Note } from 'src/shared/model/note'
import EmptyPage from './EmptyPage'

type EditorType = {
    isTrashOpened: boolean
    setIsTrashOpened: React.Dispatch<React.SetStateAction<boolean>>
    activeNote: Note | undefined
    setActiveNote: React.Dispatch<React.SetStateAction<Note | undefined>>
}

export default function Editor({
    isTrashOpened,
    setIsTrashOpened,
    activeNote,
    setActiveNote
}: EditorType): React.JSX.Element {
    if (isTrashOpened || !activeNote) {
        return (
            <EmptyPage
                isTrashOpened={isTrashOpened}
                setIsTrashOpened={setIsTrashOpened}
                activeNote={activeNote}
                setActiveNote={setActiveNote}
            />
        )
    }

    return <div className="w-full text-white flex-1">Editor</div>
}
