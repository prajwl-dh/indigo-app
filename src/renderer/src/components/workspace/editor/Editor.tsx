import NoteOptionsComponent from '@renderer/components/ui/NoteOptionsComponent'
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import { debounce } from 'lodash'
import React from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import ReactTimeAgo from 'react-time-ago'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import { Folders, Note, Notes } from 'src/shared/model/note'
import BlockEditor from './BlockEditor'
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
    const updateNoteTitle = React.useRef(
        debounce(async (note: Note, updatedTitle: string) => {
            const updatedNote = await window.notesApi.updateNote({
                ...note,
                title: updatedTitle
            })

            await reloadAllNotes()
            setActiveNote(updatedNote)
        }, 400)
    )

    const updateNoteBody = React.useRef(
        debounce(async (id: number, updatedBody: string) => {
            const updatedNote = await window.notesApi.updateNote({
                id,
                body: updatedBody
            })

            await reloadAllNotes()
            setActiveNote(updatedNote)
        }, 400)
    )

    React.useEffect(() => {
        const debouncedTitle = updateNoteTitle.current
        const debouncedBody = updateNoteBody.current

        return () => {
            debouncedTitle.cancel()
            debouncedBody.cancel()
        }
    }, [])

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
        <div className="w-full h-full text-light-primaryText dark:text-dark-primaryText overflow-x-hidden">
            <div className="fixed top-1 right-2 max-w-80 bg-transparent dark:bg-transparent backdrop-blur-sm z-50 rounded-lg border-light-border dark:border-dark-border">
                <div
                    className={`flex flex-row items-center gap-4 justify-end py-1 px-3 select-none`}
                >
                    <div className={`flex flex-row items-center gap-2`}>
                        <span
                            className={`text-[10px] font-medium uppercase tracking-wider text-light-secondaryText dark:text-dark-tertext-light-secondaryText`}
                        >
                            {isTrashOpened ? 'Moved to Trash: ' : 'Last Edited: '}
                        </span>
                        <span
                            className={`text-[11px] font-medium text-light-primaryText dark:text-dark-primaryText`}
                        >
                            <ReactTimeAgo
                                date={new Date(activeNote.lastModified || '')}
                                locale="en"
                            />
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
                        anchor="bottom end"
                        className="mt-2"
                    />
                </div>
            </div>
            <div className="flex flex-col items-center justify-center">
                <TextareaAutosize
                    disabled={isTrashOpened}
                    placeholder="Untitled Note"
                    className={`mt-32 px-13 w-full max-w-4xl wrap-break-word text-2xl 2xl:text-3xl tracking-wide font-extrabold border-none outline-none bg-transparent placeholder-opacity-40 resize-none ${accentValue[activeAccent].selection}`}
                    value={activeNote.title}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                        }
                    }}
                    onChange={(e) => {
                        if (!activeNote) return
                        const newTitle = e.target.value

                        setActiveNote({ ...activeNote, title: newTitle })
                        updateNoteTitle.current(activeNote, newTitle)
                    }}
                />
                <BlockEditor
                    updateNoteBody={updateNoteBody}
                    note={activeNote}
                    className={`mt-6 mb-20 flex-1 w-full max-w-4xl ${accentValue[activeAccent].selection}`}
                    isTrashOpened={isTrashOpened}
                />
            </div>
        </div>
    )
}
