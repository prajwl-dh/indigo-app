import React from 'react'
import { Accent } from 'src/shared/model/accent'
import InitialLanding from './pages/InitialLanding'
import Workspace from './pages/Workspace'

function App(): React.JSX.Element {
    const [activeDatabase, setActiveDatabase] = React.useState<string | null>()
    const [activeAccent, setActiveAccent] = React.useState<Accent | null>()

    async function getActiveDatabase(): Promise<void> {
        try {
            const response = await window.databaseApi.getActiveDatabasePath()
            setActiveDatabase(response)
        } catch (error) {
            throw new Error(JSON.stringify(error))
        }
    }

    async function getActiveAccent(): Promise<void> {
        try {
            const response = await window.accentApi.getAccent()
            setActiveAccent(response)
        } catch (error) {
            throw new Error(JSON.stringify(error))
        }
    }

    async function changeActiveAccent(accent: Accent): Promise<void> {
        try {
            const response = await window.accentApi.setAccent(accent)
            setActiveAccent(response)
        } catch (error) {
            throw new Error(JSON.stringify(error))
        }
    }

    React.useEffect(() => {
        getActiveDatabase()
        getActiveAccent()
    }, [])

    if (!activeDatabase) {
        return activeAccent ? <InitialLanding activeAccent={activeAccent} /> : <></>
    }

    if (!activeAccent) {
        return <></>
    }

    return (
        <Workspace
            activeDatabase={activeDatabase}
            activeAccent={activeAccent}
            changeActiveAccent={changeActiveAccent}
        />
    )
}

export default App
