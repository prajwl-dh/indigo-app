import { ChevronLeft, Database, Heart, Menu, Plus, Search, Trash2, X } from 'lucide-react'
import React from 'react'
import { useDraggable } from 'react-use-draggable-scroll'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import Button from '../ui/Button'
import FolderChip from '../ui/FolderChip'

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
    const [activeFolder, setActiveFolder] = React.useState<string>('All')

    const folderChipRef = React.useRef<HTMLDivElement>(
        null
    ) as React.MutableRefObject<HTMLInputElement>

    const { events } = useDraggable(folderChipRef)

    function toggleSidebar(): void {
        setIsSidebarOpen((prev) => !prev)
    }

    return (
        <div
            className={`${isSidebarOpen ? 'w-60 md:w-64 lg:w-72' : 'w-16 md:w-18 items-center'} flex shrink-0 flex-col bg-light-foreground dark:bg-dark-foreground border-r border-light-border dark:border-dark-border transition-discrete duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden`}
        >
            {/* Active Database Section */}
            {isSidebarOpen && (
                <div className="flex gap-2 justify-start items-center px-2 border-b border-light-border dark:border-dark-border text-[10px] font-medium text-light-secondaryText dark:text-dark-secondaryText bg-light-surface dark:bg-dark-surface">
                    <Database className="w-3 shrink-0" />
                    <span className="cursor-default">{activeDatabase}</span>
                </div>
            )}

            {/* Header Section */}
            <div
                className={`flex ${isSidebarOpen ? 'flex-row justify-between' : 'flex-col gap-3 mt-1'} items-center shrink-0 p-2 cursor-default`}
            >
                <div className={`flex flex-row items-center gap-2`} hidden={!isSidebarOpen}>
                    <span
                        className={`w-5 h-5 p-0.5 rounded-md flex items-center justify-center text-white text-[14px] font-bold ${accentValue[activeAccent].bg}`}
                    >
                        I
                    </span>
                    <div className="text-[16px] font-semibold tracking-tight text-light-primaryText dark:text-dark-primaryText">
                        {isTrashOpened ? 'Trash' : 'Indigo'}
                    </div>
                </div>
                <span
                    hidden={isSidebarOpen}
                    className={`w-7 h-7 p-1 rounded-md flex items-center justify-center text-white text-lg font-bold ${accentValue[activeAccent].bg}`}
                >
                    I
                </span>
                <Button
                    onClick={toggleSidebar}
                    className={`p-1 rounded-md text-light-secondaryText dark:text-dark-secondaryText ${isSidebarOpen ? 'border-none' : 'border'} hover:brightness-80 dark:hover:brightness-120`}
                >
                    {isSidebarOpen ? (
                        <ChevronLeft className="h-4 w-4" />
                    ) : (
                        <Menu className="h-5 w-5" />
                    )}
                </Button>
            </div>

            {isSidebarOpen && (
                <div className="flex flex-col gap-3 p-2 shrink-0">
                    <div
                        className={`flex flex-row items-center gap-2 p-2 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-[#1c1c1e] text-light-secondaryText dark:text-dark-secondaryText`}
                    >
                        <Search className="h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search"
                            className={`flex-1 border-none outline-none text text-xs text-light-primaryText dark:text-dark-primaryText`}
                        />
                        <X className="h-4 w-4 hover:text-light-primaryText dark:hover:text-dark-primaryText" />
                    </div>

                    {/* Action Button */}
                    <Button
                        hidden={isTrashOpened}
                        className={`flex flex-row items-center justify-center gap-1 text-white rounded-lg text-[14px] font-medium transition duration-300 ${accentValue[activeAccent].bg} ${accentValue[activeAccent].bgHover} hover:-translate-y-0.5`}
                    >
                        <Plus className="mb-1 h-4 w-4" />
                        <span>New Note</span>
                    </Button>
                    <Button
                        hidden={!isTrashOpened}
                        className={`flex flex-row items-center justify-center gap-2 text-white rounded-lg text-[14px] font-medium transition duration-300 bg-red-500 hover:bg-red-600 hover:-translate-y-0.5`}
                    >
                        <Trash2 className="h-4 w-4 mb-1" />
                        <span>Empty Trash</span>
                    </Button>
                </div>
            )}

            {/* Folder Chips */}
            {isSidebarOpen && (
                <div
                    {...events}
                    ref={folderChipRef}
                    className="flex row items-center gap-1 p-2 shrink-0 overflow-x-auto no-scrollbar select-none cursor-default"
                    hidden={isTrashOpened}
                >
                    <FolderChip
                        className={`${activeFolder === 'All' ? `${accentValue[activeAccent].border} ${accentValue[activeAccent].bgSubtle}` : accentValue[activeAccent].hover}`}
                    >
                        <span
                            className={`${activeFolder === 'All' ? accentValue[activeAccent].text : null}`}
                        >
                            All
                        </span>
                        <span className="text-light-secondaryText dark:text-dark-secondaryText">
                            5
                        </span>
                    </FolderChip>

                    <FolderChip
                        className={`${activeFolder === 'Favorites' ? `${accentValue[activeAccent].border} ${accentValue[activeAccent].bgSubtle}` : accentValue[activeAccent].active}`}
                    >
                        <Heart
                            className={`h-3 w-3 opacity-70 ${activeFolder === 'Favorites' ? accentValue[activeAccent].text : null}`}
                        />
                        <span
                            className={`${activeFolder === 'Favorites' ? accentValue[activeAccent].text : null}`}
                        >
                            Favorites
                        </span>
                        <span className="text-light-secondaryText dark:text-dark-secondaryText">
                            3
                        </span>
                    </FolderChip>

                    <div className={`w-px h-5 mx-1 shrink-0 bg-gray-300 dark:bg-gray-600`} />

                    <FolderChip
                        className={`${activeFolder === 'Personal' ? `${accentValue[activeAccent].border} ${accentValue[activeAccent].bgSubtle}` : accentValue[activeAccent].active}`}
                    >
                        <span
                            className={`${activeFolder === 'Personal' ? accentValue[activeAccent].text : null}`}
                        >
                            Personal
                        </span>
                        <span className="text-light-secondaryText dark:text-dark-secondaryText">
                            1
                        </span>
                    </FolderChip>

                    <FolderChip
                        className={`${activeFolder === 'Work' ? `${accentValue[activeAccent].border} ${accentValue[activeAccent].bgSubtle}` : accentValue[activeAccent].active}`}
                    >
                        <span
                            className={`${activeFolder === 'Work' ? accentValue[activeAccent].text : null}`}
                        >
                            Work
                        </span>
                        <span className="text-light-secondaryText dark:text-dark-secondaryText">
                            2
                        </span>
                    </FolderChip>
                </div>
            )}
        </div>
    )
}
