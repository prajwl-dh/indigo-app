import React from 'react'

function App(): React.JSX.Element {
    async function createNotesDatabase(): Promise<void> {
        await window.notesApi.createDatabase()
    }

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-red-50 dark:bg-amber-200">
            <button
                className="border rounded p-2 min-w-20 cursor-pointer"
                onClick={createNotesDatabase}
            >
                Create Db
            </button>
        </div>
    )
}

export default App
