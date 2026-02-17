import NoteOptionsComponent from '@renderer/components/ui/NoteOptionsComponent'
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import React from 'react'
import TextareaAutosize from 'react-textarea-autosize'
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
    const [title, setTitle] = React.useState<string | undefined>('Welcome To My Notes')

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
            <div className={`flex flex-row items-center gap-4 justify-end px-10 py-6`}>
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
            <TextareaAutosize
                placeholder="Untitled Note"
                className="mt-16 flex-1 px-12 xl:px-24 w-full wrap-break-word text-2xl lg:text-3xl font-extrabold border-none outline-none bg-transparent placeholder-opacity-40 resize-none"
                value={title}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault()
                    }
                }}
                onChange={(e) => {
                    setTitle(e.target.value)
                }}
            />
            <p
                className={`mt-10 px-12 xl:px-24 w-full wrap-break-word outline-none text-lg leading-relaxed`}
            >
                {activeNote.body}
            </p>
        </div>
    )
}
