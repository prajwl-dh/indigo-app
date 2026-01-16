import { Database } from 'lucide-react'
import React from 'react'

type SidebarType = {
    activeDatabase: string
}

export default function Sidebar({ activeDatabase }: SidebarType): React.JSX.Element {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(true)

    function toggleSidebar(): void {
        setIsSidebarOpen((prev) => !prev)
    }

    console.log(activeDatabase)
    return (
        <div className="w-70 lg:w-80 flex shrink-0 flex-col bg-light-foreground dark:bg-dark-foreground border-r border-light-border dark:border-dark-border transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden">
            {isSidebarOpen && (
                <div className="flex gap-2 justify-start items-center px-2 py-1 border-b border-light-border dark:border-dark-border text-[10px] font-medium text-light-secondaryText dark:text-dark-secondaryText">
                    <Database className="w-3 shrink-0" />
                    <span>{activeDatabase}</span>
                </div>
            )}
            Sidebar
        </div>
    )
}
