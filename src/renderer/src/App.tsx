import React, { useEffect } from 'react'

function App(): React.JSX.Element {
    async function createNotesDatabase(): Promise<void> {
        const result = await window.databaseApi.createDatabase()
        console.log('Note database created on : ' + result)
    }

    async function loadNotesDatabase(): Promise<void> {
        const result = await window.databaseApi.loadDatabase()
        console.log('Note database loaded from : ' + result)
    }

    async function loadActiveDatabasePath(): Promise<void> {
        const result = await window.databaseApi.getActiveDatabasePath()
        console.log('Active database is : ' + result)
    }

    async function deleteActiveDatabasePath(): Promise<void> {
        await window.databaseApi.deleteActiveDatabasePath()
    }

    async function addNewNote(): Promise<void> {
        await window.notesApi.createNote()
    }

    useEffect(() => {
        loadActiveDatabasePath()
    })

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-red-50 dark:bg-amber-200 gap-2">
            <button
                className="border rounded p-2 min-w-20 cursor-pointer"
                onClick={createNotesDatabase}
            >
                Create Db
            </button>
            <button
                className="border rounded p-2 min-w-20 cursor-pointer"
                onClick={loadNotesDatabase}
            >
                Load Db
            </button>
            <button className="border rounded p-2 min-w-20 cursor-pointer" onClick={addNewNote}>
                Add New Note
            </button>
            <button
                className="border rounded p-2 min-w-20 cursor-pointer"
                onClick={deleteActiveDatabasePath}
            >
                Delete Active Database
            </button>
        </div>
    )
}

export default App
