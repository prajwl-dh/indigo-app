import React from 'react'

function App(): React.JSX.Element {
    async function createNotesDatabase(): Promise<void> {
        const result = await window.notesApi.createDatabase()
        console.log('Note database created on : ' + result)
    }

    async function loadNotesDatabase(): Promise<void> {
        const result = await window.notesApi.loadDatabase()
        console.log('Note database loaded from : ' + result)
    }

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-red-50 dark:bg-amber-200">
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
        </div>
    )
}

export default App
