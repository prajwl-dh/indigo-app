import React from 'react'
import InitialLanding from './pages/InitialLanding'

function App(): React.JSX.Element {
    const [activeDatabase, setActiveDatabase] = React.useState<string | null>()

    async function getActiveDatabase(): Promise<void> {
        try {
            const response = await window.databaseApi.getActiveDatabasePath()
            setActiveDatabase(response)
        } catch (error) {
            throw new Error(JSON.stringify(error))
        }
    }

    React.useEffect(() => {
        getActiveDatabase()
    }, [])

    if (!activeDatabase) {
        return <InitialLanding />
    }

    return <>App</>
}

export default App
