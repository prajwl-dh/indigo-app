import React from 'react'
import { Accent } from 'src/shared/model/accent'
import { Theme } from 'src/shared/model/theme'
import InitialLanding from './pages/InitialLanding'

function App(): React.JSX.Element {
    const [activeDatabase, setActiveDatabase] = React.useState<string | null>()
    const [activeAccent, setActiveAccent] = React.useState<Accent | null>()
    const [activeTheme, setActiveTheme] = React.useState<Theme>('system')

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

    async function getCurrentTheme(): Promise<void> {
        try {
            const response = await window.themeApi.getTheme()
            setActiveTheme(response)
            console.log(activeTheme)
        } catch (error) {
            throw new Error(JSON.stringify(error))
        }
    }

    React.useEffect(() => {
        getActiveDatabase()
        getCurrentTheme()
        getActiveAccent()
    })

    if (!activeDatabase) {
        if (activeAccent) {
            return <InitialLanding activeAccent={activeAccent} />
        }
    }

    return <>App</>
}

export default App
