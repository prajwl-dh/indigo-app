import Editor from '@renderer/components/workspace/Editor'
import Sidebar from '@renderer/components/workspace/Sidebar'
import React from 'react'
import { Accent } from 'src/shared/model/accent'

type WorkspaceType = {
    activeDatabase: string
    activeAccent: Accent
}

export default function Workspace({
    activeDatabase,
    activeAccent
}: WorkspaceType): React.JSX.Element {
    const [isTrashOpened, setIsTrashOpened] = React.useState<boolean>(false)

    return (
        <div className="h-screen w-screen flex flex-nowrap">
            <Sidebar
                activeDatabase={activeDatabase}
                activeAccent={activeAccent}
                isTrashOpened={isTrashOpened}
                setIsTrashOpened={setIsTrashOpened}
            />
            <Editor />
        </div>
    )
}
