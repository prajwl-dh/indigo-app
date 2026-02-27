import React from 'react'
import { Accent } from 'src/shared/model/accent'
import { Theme } from 'src/shared/model/theme'
import InitialLanding from './pages/InitialLanding'
import Workspace from './pages/Workspace'

function App(): React.JSX.Element {
    const [activeDatabase, setActiveDatabase] = React.useState<string | null>()
    const [activeAccent, setActiveAccent] = React.useState<Accent | null>()
    const [activeTheme, setActiveTheme] = React.useState<Theme | null>()
    const [initializing, setInitializing] = React.useState<boolean>(false)

    async function getActiveDatabase(): Promise<void> {
        try {
            setInitializing(true)
            const response = await window.databaseApi.getActiveDatabasePath()
            setActiveDatabase(response)
            setInitializing(false)
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

    async function getActiveTheme(): Promise<void> {
        try {
            const response = await window.themeApi.getTheme()
            setActiveTheme(response)
        } catch (error) {
            throw new Error(JSON.stringify(error))
        }
    }

    async function changeActiveTheme(theme: Theme): Promise<void> {
        try {
            const response = await window.themeApi.setTheme(theme)
            setActiveTheme(response)
        } catch (error) {
            throw new Error(JSON.stringify(error))
        }
    }

    React.useEffect(() => {
        getActiveDatabase()
        getActiveAccent()
        getActiveTheme()
    }, [])

    if (!activeAccent) {
        return <></>
    }

    if (!activeTheme) {
        return <></>
    }

    if (initializing) {
        return <></>
    }

    if (!activeDatabase) {
        return initializing ? <></> : <InitialLanding activeAccent={activeAccent} />
    }

    return (
        <Workspace
            activeDatabase={activeDatabase}
            activeAccent={activeAccent}
            changeActiveAccent={changeActiveAccent}
            activeTheme={activeTheme}
            changeActiveTheme={changeActiveTheme}
        />
    )
}

export default App
