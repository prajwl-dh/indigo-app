import { useState, type JSX } from 'react'
import Shell from './components/Shell'
import { AppearanceProvider } from './state/appearance'
import { ToastProvider } from './state/toast'
import { UpdateProvider } from './state/updates'
import { WorkspaceProvider } from './state/workspace'

function Surface(): JSX.Element {
    const [settingsOpen, setSettingsOpen] = useState(false)

    return (
        <WorkspaceProvider onOpenSettings={() => setSettingsOpen(true)}>
            <Shell settingsOpen={settingsOpen} onCloseSettings={() => setSettingsOpen(false)} />
        </WorkspaceProvider>
    )
}

function App(): JSX.Element {
    return (
        <ToastProvider>
            <AppearanceProvider>
                <UpdateProvider>
                    <Surface />
                </UpdateProvider>
            </AppearanceProvider>
        </ToastProvider>
    )
}

export default App
