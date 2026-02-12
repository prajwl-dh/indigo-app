import { FileText, Trash2 } from 'lucide-react'
import React from 'react'
import { Note } from 'src/shared/model/note'

type EmptyPageType = {
    isTrashOpened: boolean
    setIsTrashOpened: React.Dispatch<React.SetStateAction<boolean>>
    activeNote: Note | undefined
    setActiveNote: React.Dispatch<React.SetStateAction<Note | undefined>>
}

export default function EmptyPage({
    isTrashOpened,
    setIsTrashOpened,
    activeNote,
    setActiveNote
}: EmptyPageType): React.JSX.Element {
    return (
        <div className="w-full flex flex-col items-center justify-center text-center -mt-5 animate-in fade-in zoom-in-95 duration-500">
            <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-sm bg-light-foreground dark:bg-dark-foreground`}
            >
                {isTrashOpened ? (
                    <Trash2
                        className={`w-8 h-8 text-light-secondaryText dark:text-dark-sectext-light-secondaryText`}
                    />
                ) : (
                    <FileText
                        className={`w-8 h-8 text-light-secondaryText dark:text-dark-sectext-light-secondaryText`}
                    />
                )}
            </div>
            <h3
                className={`text-lg font-semibold mb-2 text-light-primaryText dark:text-dark-primaryText`}
            >
                {isTrashOpened
                    ? !activeNote
                        ? 'Select a Deleted Note'
                        : 'Trash is Empty'
                    : 'Select a Note'}
            </h3>
            <p
                className={`max-w-xs text-sm leading-relaxed text-light-secondaryText dark:text-dark-secondaryText`}
            >
                {isTrashOpened
                    ? !activeNote
                        ? 'Select a note from the sidebar to view it or restore it.'
                        : 'Notes you delete are moved here. You can restore them anytime.'
                    : 'Select a note from the sidebar to view it, or create a new one to get started.'}
            </p>
        </div>
    )
}
