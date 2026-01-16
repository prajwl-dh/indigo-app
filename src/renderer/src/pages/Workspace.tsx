import Editor from '@renderer/components/workspace/Editor'
import Sidebar from '@renderer/components/workspace/Sidebar'
import React from 'react'

type WorkspaceType = {
    activeDatabase: string
}

export default function Workspace({ activeDatabase }: WorkspaceType): React.JSX.Element {
    return (
        <div className="h-screen w-screen flex flex-nowrap">
            <Sidebar activeDatabase={activeDatabase} />
            <Editor />
        </div>
    )
}
