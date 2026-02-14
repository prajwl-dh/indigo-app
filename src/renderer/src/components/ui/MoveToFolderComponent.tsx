import { Check, Folder, Search, X } from 'lucide-react'
import React from 'react'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import { Folders, Note } from 'src/shared/model/note'
import { normalizeNoSpace } from 'src/shared/util/stringUtils'

type MoveToFolderComponentProps = {
    activeAccent: Accent
    folders: Folders
    note: Note
}

export default function MoveToFolderComponent({
    activeAccent,
    folders,
    note
}: MoveToFolderComponentProps): React.JSX.Element {
    const [moveToFolderSearchQuery, setMoveToFolderSearchQuery] = React.useState<string>('')

    const sortedFolders = [
        ...folders.filter((folder) => folder.id === note.folderId),
        ...folders.filter((folder) => folder.id !== note.folderId)
    ]

    const filteredFolder = sortedFolders.filter((folder) => {
        const query = normalizeNoSpace(moveToFolderSearchQuery)
        if (!query) return true

        const folderName = normalizeNoSpace((folder.name || '').toLowerCase())

        return folderName.includes(query)
    })

    return (
        <div className={`px-3 -mt-1 flex flex-col gap-1`}>
            <span className="text-light-tertiaryText dark:text-dark-tertiaryText text-[10px] uppercase font-medium tracking-wider">
                Move To
            </span>
            <div className="flex flex-col max-h-32 overflow-x-hidden">
                <div
                    className={`flex flex-row items-center justify-between p-1 gap-1 border border-light-border dark:border-dark-border rounded-lg bg-light-background dark:bg-dark-surface text-light-secondaryText dark:text-dark-secondaryText`}
                >
                    <Search className="h-3 w-3 shrink-0 hover:text-light-primaryText dark:hover:text-dark-primaryText" />
                    <input
                        type="text"
                        placeholder="Search Folder"
                        value={moveToFolderSearchQuery}
                        onChange={(e) => setMoveToFolderSearchQuery(e.target.value)}
                        className={`w-full border-none outline-none text text-xs text-light-primaryText dark:text-dark-primaryText ${accentValue[activeAccent].selection}`}
                    />
                    <button
                        title="Clear Search"
                        onClick={() => setMoveToFolderSearchQuery('')}
                        hidden={moveToFolderSearchQuery.trim().length === 0}
                    >
                        <X className="h-3 w-3 shrink-0 hover:text-light-primaryText dark:hover:text-dark-primaryText" />
                    </button>
                </div>
                <div className={`flex flex-col overflow-y-scroll`}>
                    <div
                        className="text-light-secondaryText dark:text-dark-secondaryText px-2 pt-4 text-center text-xs select-none"
                        hidden={filteredFolder.length > 0}
                    >
                        No matching folder
                    </div>
                    {filteredFolder.map((folder) => (
                        <button
                            title={folder.name}
                            key={folder.id}
                            className={`w-full px-3 mt-1 py-1 text-[13px] flex items-center justify-between ${accentValue[activeAccent].hover} rounded-lg outline-none ${note.folderId === folder.id ? `${accentValue[activeAccent].text}` : `text-light-primaryText dark:text-dark-primaryText`}`}
                        >
                            <div className="flex items-center gap-2.5 truncate">
                                <div>
                                    <Folder className="w-3.5 h-3.5" />
                                </div>
                                <span className="truncate">{folder.name}</span>
                            </div>
                            <Check
                                className={`w-3.5 h-3.5 ${note.folderId !== folder.id && 'hidden'}`}
                            />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
