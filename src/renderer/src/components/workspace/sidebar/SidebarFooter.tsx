import { Archive, Check, Monitor, Moon, Palette, Sun, Trash2 } from 'lucide-react'
import React from 'react'
import { Accent, accents } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'
import { Note } from 'src/shared/model/note'
import { Theme, themes } from 'src/shared/model/theme'
import { capitalizeWords } from 'src/shared/util/stringUtils'
import Button from '../../ui/Button'
import PopoverComponent from '../../ui/PopOver'

type SidebarFooterProps = {
    isSidebarOpen: boolean
    isTrashOpened: boolean
    setIsTrashOpened: React.Dispatch<React.SetStateAction<boolean>>
    setActiveNote: React.Dispatch<React.SetStateAction<Note | undefined>>
    activeAccent: Accent
    changeActiveAccent: (accent: Accent) => Promise<void>
    activeTheme: Theme
    changeActiveTheme: (theme: Theme) => Promise<void>
}

export default function SidebarFooter({
    isSidebarOpen,
    isTrashOpened,
    setIsTrashOpened,
    setActiveNote,
    activeAccent,
    changeActiveAccent,
    activeTheme,
    changeActiveTheme
}: SidebarFooterProps): React.JSX.Element {
    return (
        <div
            className={`px-2 py-3 flex ${isSidebarOpen ? 'flex-row justify-between' : 'flex-col-reverse gap-4'} items-center shrink-0 border-t w-full border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface`}
        >
            <span
                className={`text-xs font-normal opacity-50 text-light-secondaryText dark:text-dark-secondaryText select-none`}
            >
                v1.0
            </span>
            <div
                className={`flex ${isSidebarOpen ? 'flex-row' : 'flex-col'} gap-2 text-light-secondaryText dark:text-dark-secondaryText`}
            >
                <Button
                    title="Toggle Trash"
                    onClick={() => {
                        setIsTrashOpened((prev) => !prev)
                        setActiveNote(undefined)
                    }}
                    className={`p-2 border-none ${isTrashOpened ? accentValue[activeAccent].bgSubtle : null} hover:text-light-primaryText dark:hover:text-dark-primaryText transition-transform active:scale-95 hover:scale-110 shrink-0 ${!isSidebarOpen && 'hidden'}`}
                >
                    <Trash2 className={`h-4 w-4 ${isTrashOpened ? 'hidden' : null}`} />
                    <Archive className={`h-4 w-4 ${!isTrashOpened ? 'hidden' : null}`} />
                </Button>

                <PopoverComponent
                    title="App Accent Picker"
                    buttonClassName="cursor-default"
                    panelClassName="p-2 min-w-32 border border-light-border dark:border-dark-border rounded-lg grid grid-cols-3 gap-2"
                    anchor={isSidebarOpen ? 'top start' : 'right'}
                    trigger={
                        <Button
                            className={`p-2 border-none hover:text-light-primaryText dark:hover:text-dark-primaryText transition-transform active:scale-95 hover:scale-110 shrink-0`}
                        >
                            <Palette className="h-4 w-4" />
                        </Button>
                    }
                >
                    {accents.map((accent) => (
                        <button
                            title={capitalizeWords(accent)}
                            key={accent}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95 hover:scale-110 shrink-0`}
                            style={{ background: accentValue[accent].hex }}
                            onClick={() => changeActiveAccent(accent)}
                        >
                            {activeAccent === accent && (
                                <Check
                                    className="w-4 h-4 text-white drop-shadow-md"
                                    strokeWidth={3}
                                />
                            )}
                        </button>
                    ))}
                </PopoverComponent>

                <PopoverComponent
                    title="Light/Dark Theme Switcher"
                    buttonClassName="cursor-default"
                    anchor={isSidebarOpen ? 'top start' : 'right'}
                    panelClassName="min-w-32 border border-light-border dark:border-dark-border rounded-lg p-1 flex flex-col gap-1 select-none"
                    trigger={
                        <Button
                            className={`p-2 border-none hover:text-light-primaryText dark:hover:text-dark-primaryText transition-transform active:scale-95 hover:scale-110 shrink-0`}
                        >
                            <Sun
                                className={`h-4 w-4 flex items-center justify-center ${activeTheme !== 'light' ? 'hidden' : null}`}
                            />
                            <Moon
                                className={`h-4 w-4 flex items-center justify-center ${activeTheme !== 'dark' ? 'hidden' : null}`}
                            />
                            <Monitor
                                className={`h-4 w-4 flex items-center justify-center ${activeTheme !== 'system' ? 'hidden' : null}`}
                            />
                        </Button>
                    }
                >
                    {themes.map((theme) => (
                        <button
                            key={theme}
                            className={`w-full px-3 py-1 text-[13px] flex items-center gap-2.5 ${activeTheme === theme && accentValue[activeAccent].bgSubtle} ${activeTheme === theme ? accentValue[activeAccent].text : 'text-light-primaryText dark:text-dark-primaryText'} ${accentValue[activeAccent].hover} rounded-lg outline-none`}
                            onClick={() => changeActiveTheme(theme)}
                        >
                            {theme === 'light' && <Sun className="w-4 h-4" />}
                            {theme === 'dark' && <Moon className="w-4 h-4" />}
                            {theme === 'system' && <Monitor className="w-4 h-4" />}
                            {capitalizeWords(theme)}
                        </button>
                    ))}
                </PopoverComponent>
            </div>
        </div>
    )
}
