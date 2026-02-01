import Editor from '@renderer/components/workspace/Editor'
import Sidebar from '@renderer/components/workspace/Sidebar'
import React from 'react'
import { Accent } from 'src/shared/model/accent'
import { Folder, Folders, Notes } from 'src/shared/model/note'

type WorkspaceType = {
    activeDatabase: string
    activeAccent: Accent
    changeActiveAccent: (accent: Accent) => Promise<void>
}

export default function Workspace({
    activeDatabase,
    activeAccent,
    changeActiveAccent
}: WorkspaceType): React.JSX.Element {
    const [isTrashOpened, setIsTrashOpened] = React.useState<boolean>(false)
    const [activeFolder, setActiveFolder] = React.useState<Folder>({ id: 0, name: 'All' })
    const [notes, setNotes] = React.useState<Notes>([])
    const [folders, setFolders] = React.useState<Folders>([])

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

    return (
        <div className="h-screen w-screen flex flex-nowrap">
            <Sidebar
                activeDatabase={activeDatabase}
                activeAccent={activeAccent}
                isTrashOpened={isTrashOpened}
                setIsTrashOpened={setIsTrashOpened}
                activeFolder={activeFolder}
                setActiveFolder={setActiveFolder}
                notes={notes}
                setNotes={setNotes}
                folders={folders}
                setFolders={setFolders}
                changeActiveAccent={changeActiveAccent}
            />
            <Editor />
        </div>
    )
}
