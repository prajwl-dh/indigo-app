import { ChevronLeft, Database, Menu } from 'lucide-react'
import React from 'react'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import Button from '../ui/Button'

type SidebarType = {
    activeDatabase: string
    activeAccent: Accent
    isTrashOpened: boolean
    setIsTrashOpened: React.Dispatch<React.SetStateAction<boolean>>
}

export default function Sidebar({
    activeDatabase,
    activeAccent,
    isTrashOpened,
    setIsTrashOpened
}: SidebarType): React.JSX.Element {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(true)

    function toggleSidebar(): void {
        setIsSidebarOpen((prev) => !prev)
    }

    console.log(activeDatabase)
    return (
        <div
            className={`${isSidebarOpen ? 'w-70 lg:w-80' : 'w-16 items-center'} flex shrink-0 flex-col bg-light-foreground dark:bg-dark-foreground border-r border-light-border dark:border-dark-border transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden`}
        >
            {isSidebarOpen && (
                <div className="flex gap-2 justify-start items-center px-2 py-1 border-b border-light-border dark:border-dark-border text-[10px] font-medium text-light-secondaryText dark:text-dark-secondaryText bg-light-surface dark:bg-dark-surface">
                    <Database className="w-3 shrink-0" />
                    <span className="cursor-default">{activeDatabase}</span>
                </div>
            )}

            <div
                className={`flex ${isSidebarOpen ? 'flex-row justify-between' : 'flex-col gap-3 mt-1'} items-center shrink-0 p-2`}
            >
                <div className={`flex flex-row items-center gap-2`} hidden={!isSidebarOpen}>
                    <div
                        className={`w-5 h-5 p-0.5 rounded-md flex items-center justify-center text-white text-[10px] font-bold ${accentValue[activeAccent].bg}`}
                    >
                        I
                    </div>
                    <span className="text-[16px] font-semibold tracking-tight text-light-primaryText dark:text-dark-primaryText">
                        {isTrashOpened ? 'Trash' : 'Indigo'}
                    </span>
                </div>
                <div
                    hidden={isSidebarOpen}
                    className={`w-6 h-6 p-1 rounded-md flex items-center justify-center text-white text-lg font-bold transition-all duration-500 ${accentValue[activeAccent].bg}`}
                >
                    I
                </div>
                <Button
                    onClick={toggleSidebar}
                    className={`p-1 rounded-md text-light-secondaryText dark:text-dark-secondaryText border-none transition-all duration-500 ${accentValue[activeAccent].hover}`}
                >
                    {isSidebarOpen ? (
                        <ChevronLeft className="h-4 w-4" />
                    ) : (
                        <Menu className="h-5 w-5" />
                    )}
                </Button>
            </div>
        </div>
    )
}
