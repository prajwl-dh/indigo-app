import React, { useEffect, useState } from 'react'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import { Notes } from 'src/shared/model/note'

function App(): React.JSX.Element {
    const [notes, setNotes] = useState<Notes>([])
    const [activeDatabase, setActiveDatabase] = useState<string | null>()
    const [accent, setAccent] = useState<Accent>('indigo')

    async function createNotesDatabase(): Promise<void> {
        const result = await window.databaseApi.createDatabase()
        console.log('Note database created on : ' + result)
    }

    async function loadNotesDatabase(): Promise<void> {
        const result = await window.databaseApi.loadDatabase()
        console.log('Note database loaded from : ' + result)
    }

    async function loadActiveDatabasePath(): Promise<void> {
        try {
            const result = await window.databaseApi.getActiveDatabasePath()
            setActiveDatabase(result)
        } catch (error) {
            console.error(error)
        }
    }

    async function deleteActiveDatabasePath(): Promise<void> {
        await window.databaseApi.deleteActiveDatabasePath()
    }

    async function addNewNote(): Promise<void> {
        try {
            const response = await window.notesApi.createNote()
            console.log(response)
        } catch (error) {
            console.log(error)
        }
    }

    async function getAllNotes(): Promise<void> {
        try {
            const response = await window.notesApi.getAllNotes()
            setNotes(response)
        } catch (error) {
            console.error(error)
        }
    }

    async function updateANote(): Promise<void> {
        const id = 2
        const name = 'Asmita'

        try {
            await window.notesApi.updateNote({
                id: id,
                title: `Hello ${name}`,
                body: `Hello ${name}`,
                isFavourite: true
            })
        } catch (error) {
            console.error(error)
        }
    }

    async function deleteANote(): Promise<void> {
        const id = 2

        try {
            await window.notesApi.deleteNote({ id: id })
        } catch (error) {
            console.error(error)
        }
    }

    async function loadAccentColor(): Promise<void> {
        const response = await window.accentApi.getAccent()
        setAccent(response)
    }

    async function setAccentColor(): Promise<void> {
        let response: Accent = 'indigo'
        if (accent === 'indigo') {
            response = await window.accentApi.setAccent('rose')
        } else {
            response = await window.accentApi.setAccent('indigo')
        }
        setAccent(response)
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadActiveDatabasePath()
        loadAccentColor()
    }, [])

    console.log(notes)
    console.log('Active database is : ' + activeDatabase)
    console.log(accent)

    return (
        <div
            className={`h-screen w-screen flex flex-col items-center justify-center ${accentValue[accent]} gap-2`}
        >
            <button className="border rounded p-2 min-w-40 cursor-pointer" onClick={setAccentColor}>
                Change Accent Color
            </button>
            <button
                className="border rounded p-2 min-w-40 cursor-pointer"
                onClick={createNotesDatabase}
            >
                Create Db
            </button>
            <button
                className="border rounded p-2 min-w-40 cursor-pointer"
                onClick={loadNotesDatabase}
            >
                Load Db
            </button>
            <button
                className="border rounded p-2 min-w-40 cursor-pointer"
                onClick={deleteActiveDatabasePath}
            >
                Delete Active Database
            </button>
            {activeDatabase && activeDatabase?.trim().length > 0 && (
                <>
                    <button
                        className="border rounded p-2 min-w-40 cursor-pointer"
                        onClick={getAllNotes}
                    >
                        Get All Notes
                    </button>
                    <button
                        className="border rounded p-2 min-w-40 cursor-pointer"
                        onClick={addNewNote}
                    >
                        Add New Note
                    </button>
                    <button
                        className="border rounded p-2 min-w-40 cursor-pointer"
                        onClick={updateANote}
                    >
                        Update A Note
                    </button>
                    <button
                        className="border rounded p-2 min-w-40 cursor-pointer"
                        onClick={deleteANote}
                    >
                        Delete A Note
                    </button>
                </>
            )}
        </div>
    )
}

export default App
