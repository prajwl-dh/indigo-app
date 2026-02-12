import Editor from '@renderer/components/workspace/editor/Editor'
import Sidebar from '@renderer/components/workspace/sidebar/Sidebar'
import React from 'react'
import { Accent } from 'src/shared/model/accent'
import { Folder, Folders, Note, Notes } from 'src/shared/model/note'
import { Theme } from 'src/shared/model/theme'

type WorkspaceType = {
    activeDatabase: string
    activeAccent: Accent
    changeActiveAccent: (accent: Accent) => Promise<void>
    activeTheme: Theme
    changeActiveTheme: (theme: Theme) => Promise<void>
}

export default function Workspace({
    activeDatabase,
    activeAccent,
    changeActiveAccent,
    activeTheme,
    changeActiveTheme
}: WorkspaceType): React.JSX.Element {
    const [isTrashOpened, setIsTrashOpened] = React.useState<boolean>(false)
    const [activeFolder, setActiveFolder] = React.useState<Folder>({ id: 0, name: 'All' })
    const [notes, setNotes] = React.useState<Notes>([])
    const [folders, setFolders] = React.useState<Folders>([])
    const [activeNote, setActiveNote] = React.useState<Note>()

    async function getAllNotes(): Promise<void> {
        const response = await window.notesApi.getAllNotes()
        setNotes(response)
    }

    async function getAllFolders(): Promise<void> {
        const response = await window.notesApi.getAllFolders()
        setFolders(response)
    }

    React.useEffect(() => {
        getAllNotes()
        getAllFolders()
    }, [])

    const sortedNotes = [...notes].sort(
        (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    )

    return (
        <div className="h-screen w-screen flex flex-nowrap">
            <Sidebar
                activeDatabase={activeDatabase}
                activeAccent={activeAccent}
                isTrashOpened={isTrashOpened}
                setIsTrashOpened={setIsTrashOpened}
                activeFolder={activeFolder}
                setActiveFolder={setActiveFolder}
                notes={sortedNotes}
                setNotes={setNotes}
                folders={folders}
                setFolders={setFolders}
                changeActiveAccent={changeActiveAccent}
                activeTheme={activeTheme}
                changeActiveTheme={changeActiveTheme}
                activeNote={activeNote}
                setActiveNote={setActiveNote}
                reloadAllNotes={getAllNotes}
                reloadAllFolders={getAllFolders}
            />
            <Editor
                isTrashOpened={isTrashOpened}
                setIsTrashOpened={setIsTrashOpened}
                activeNote={activeNote}
                setActiveNote={setActiveNote}
                activeAccent={activeAccent}
            />
        </div>
    )
}
