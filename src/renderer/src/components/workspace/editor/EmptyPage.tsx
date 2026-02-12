import { FileText, Trash2 } from 'lucide-react'
import React from 'react'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import { Note } from 'src/shared/model/note'

type EmptyPageType = {
    isTrashOpened: boolean
    setIsTrashOpened: React.Dispatch<React.SetStateAction<boolean>>
    activeNote: Note | undefined
    setActiveNote: React.Dispatch<React.SetStateAction<Note | undefined>>
    activeAccent: Accent
}

export default function EmptyPage({
    isTrashOpened,
    activeNote,
    activeAccent
}: EmptyPageType): React.JSX.Element {
    return (
        <div className="w-full h-full flex flex-col gap-2 items-center justify-center text-center -mt-4">
            <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center ${isTrashOpened ? 'bg-red-500/10 dark:bg-red-500/10' : accentValue[activeAccent].bgSubtle} ${isTrashOpened ? 'text-red-600 dark:text-red-400' : accentValue[activeAccent].text}`}
            >
                {isTrashOpened ? (
                    <Trash2 className={`w-8 h-8`} />
                ) : (
                    <FileText className={`w-8 h-8`} />
                )}
            </div>
            <h3
                className={`text-lg font-semibold text-light-primaryText dark:text-dark-primaryText`}
            >
                {isTrashOpened
                    ? !activeNote
                        ? 'Select a Deleted Note'
                        : 'Trash is Empty'
                    : 'Select a Note'}
            </h3>
            <p className={`max-w-xs text-sm text-light-secondaryText dark:text-dark-secondaryText`}>
                {isTrashOpened
                    ? !activeNote
                        ? 'Select a note from the sidebar to view it or restore it.'
                        : 'Notes you delete are moved here. You can restore them anytime.'
                    : 'Select a note from the sidebar to view it, or create a new one to get started.'}
            </p>
        </div>
    )
}
