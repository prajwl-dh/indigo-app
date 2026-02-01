import Button from '@renderer/components/ui/Button'
import { FilePlus, FolderOpen } from 'lucide-react'
import React from 'react'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'

type InitialLandingType = {
    activeAccent: Accent
}

export default function InitialLanding({ activeAccent }: InitialLandingType): React.JSX.Element {
    async function createNew(): Promise<void> {
        try {
            await window.databaseApi.createDatabase()
        } catch (error) {
            console.error(error)
        }
    }

    async function openExisting(): Promise<void> {
        try {
            await window.databaseApi.loadDatabase()
        } catch (error) {
            console.error(error)
        }
    }

    return (
        <div className={`h-screen w-full flex flex-col justify-center items-center pb-10`}>
            <div className="max-w-2xl w-full flex flex-col items-center gap-12 select-none">
                {/* Branding */}
                <div className="flex flex-col gap-1 items-center text-center">
                    <h1 className="text-5xl font-extrabold text-light-primaryText dark:text-dark-primaryText">
                        Indigo
                    </h1>
                    <p
                        className={`text-xl font-medium text-light-secondaryText dark:text-dark-secondaryText`}
                    >
                        Your thoughts, simple, and organized
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center min-w-max justify-between gap-6">
                    <Button
                        className={`p-4 flex flex-col w-72 gap-2 bg-light-foreground dark:bg-dark-foreground rounded-lg transition-all duration-300 hover:-translate-y-0.5 ${accentValue[activeAccent].hover} border border-light-border dark:border-dark-border`}
                        onClick={createNew}
                    >
                        <div
                            className={`p-3 rounded-lg w-min transition-transform group-hover:scale-110 duration-300 ${accentValue[activeAccent].bgSubtle} ${accentValue[activeAccent].text}`}
                        >
                            <FilePlus className="w-7 h-7" />
                        </div>
                        <div className="flex flex-col items-start mt-auto">
                            <span className="font-bold text-lg text-light-primaryText dark:text-dark-primaryText">
                                Create New
                            </span>
                            <span
                                className={`text-sm mt-1 font-medium text-left text-light-secondaryText dark:text-dark-secondaryText`}
                            >
                                Start with a new .indigo collection
                            </span>
                        </div>
                    </Button>
                    <Button
                        className={`p-4 flex flex-col w-72 gap-2 bg-light-foreground dark:bg-dark-foreground rounded-lg transition-all duration-300 hover:-translate-y-0.5 ${accentValue[activeAccent].hover} border border-light-border dark:border-dark-border`}
                        onClick={openExisting}
                    >
                        <div
                            className={`p-3 rounded-lg w-min transition-transform group-hover:scale-110 duration-300 ${accentValue[activeAccent].bgSubtle} ${accentValue[activeAccent].text}`}
                        >
                            <FolderOpen className="w-7 h-7" />
                        </div>
                        <div className="flex flex-col items-start mt-auto">
                            <span className="font-bold text-lg text-light-primaryText dark:text-dark-primaryText">
                                Open Existing
                            </span>
                            <span
                                className={`text-sm mt-1 font-medium text-left text-light-secondaryText dark:text-dark-secondaryText`}
                            >
                                Load notes from a .indigo collection
                            </span>
                        </div>
                    </Button>
                </div>
            </div>
        </div>
    )
}
