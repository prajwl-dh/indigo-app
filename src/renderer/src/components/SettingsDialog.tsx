import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { FolderOpen, Monitor, Moon, RotateCcw, Sun, Trash2, X } from 'lucide-react'
import { useState, type JSX } from 'react'
import { themes, type Theme } from '../../../shared/model/theme'
import ConfirmDialog from './ConfirmDialog'
import { countLabel } from '../lib/format'
import { useAppearance } from '../state/appearance'
import { useToast } from '../state/toast'
import { useWorkspace } from '../state/workspace'

type SettingsDialogProps = {
    open: boolean
    onClose: () => void
}

const themeLabels: Record<Theme, string> = {
    system: 'System',
    light: 'Light',
    dark: 'Dark'
}

const themeIcons: Record<Theme, JSX.Element> = {
    system: <Monitor size={15} />,
    light: <Sun size={15} />,
    dark: <Moon size={15} />
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps): JSX.Element {
    const { theme, resolved, setTheme } = useAppearance()
    const { notes, tags, storage, refresh } = useWorkspace()
    const { pushError } = useToast()
    const [confirmSoft, setConfirmSoft] = useState(false)
    const [confirmHard, setConfirmHard] = useState(false)

    const chooseTheme = async (next: Theme): Promise<void> => {
        try {
            await setTheme(next)
        } catch (caught) {
            pushError(caught, 'Could not change the theme.')
        }
    }

    const openFolder = async (): Promise<void> => {
        try {
            await window.indigo.storage.openFolder()
        } catch (caught) {
            pushError(caught, 'Could not open the notes folder.')
        }
    }

    const finishReset = (): void => {
        try {
            for (const key of Object.keys(window.localStorage)) {
                if (key.startsWith('indigo:')) window.localStorage.removeItem(key)
            }
        } catch {
            // The main process has already cleared the source of truth.
        }

        window.location.reload()
    }

    const softReset = async (): Promise<void> => {
        await window.indigo.app.softReset()
        finishReset()
    }

    const hardReset = async (): Promise<void> => {
        await window.indigo.app.hardReset()
        finishReset()
    }

    const tagCount = tags.length
    const noteCount = storage?.noteCount ?? notes.length

    return (
        <>
            <Dialog open={open} onClose={onClose} className="settings-dialog" aria-label="Settings">
                <DialogBackdrop transition className="settings-backdrop" />
                <div className="settings-viewport">
                    <DialogPanel transition className="settings-panel">
                        <header className="settings-head">
                            <DialogTitle className="settings-title">Settings</DialogTitle>
                            <button
                                type="button"
                                className="icon-button"
                                aria-label="Close settings"
                                title="Close settings"
                                onClick={onClose}
                            >
                                <X size={17} />
                            </button>
                        </header>

                        <div className="settings-scroll">
                            <section
                                className="settings-section"
                                aria-labelledby="settings-appearance"
                            >
                                <div className="settings-label">
                                    <h2 id="settings-appearance">Appearance</h2>
                                    <p>
                                        Indigo follows your system by default. Choose a fixed theme
                                        when you want the page to stay put.
                                    </p>
                                </div>

                                <div className="settings-card">
                                    <div className="settings-field">
                                        <div className="settings-field-head">
                                            <span className="settings-field-title">Theme</span>
                                            <span className="settings-field-value">
                                                {theme === 'system'
                                                    ? `System · ${resolved === 'dark' ? 'Dark' : 'Light'}`
                                                    : themeLabels[theme]}
                                            </span>
                                        </div>
                                        <div className="segmented" role="group" aria-label="Theme">
                                            {themes.map((entry) => (
                                                <button
                                                    type="button"
                                                    key={entry}
                                                    className="segmented-option"
                                                    data-active={theme === entry ? 'true' : 'false'}
                                                    aria-pressed={theme === entry}
                                                    onClick={() => void chooseTheme(entry)}
                                                >
                                                    {themeIcons[entry]}
                                                    {themeLabels[entry]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section
                                className="settings-section"
                                aria-labelledby="settings-library"
                            >
                                <div className="settings-label">
                                    <h2 id="settings-library">Library</h2>
                                    <p>
                                        Every note is a JSON file inside one folder on this
                                        computer. Nothing leaves the machine, and there is no
                                        account to sign in to.
                                    </p>
                                </div>

                                <div className="settings-card">
                                    <div className="settings-field">
                                        <div className="settings-field-head">
                                            <span className="settings-field-title">
                                                Notes folder
                                            </span>
                                            <span className="settings-field-value">
                                                {countLabel(noteCount, 'note')} ·{' '}
                                                {countLabel(tagCount, 'tag')}
                                            </span>
                                        </div>
                                        <code className="settings-path">
                                            {storage?.notesDirectory ?? 'Reading the notes folder…'}
                                        </code>
                                        <div className="settings-actions">
                                            <button
                                                type="button"
                                                className="button button--secondary button--small"
                                                onClick={() => void openFolder()}
                                            >
                                                <FolderOpen size={14} />
                                                Open folder
                                            </button>
                                            <button
                                                type="button"
                                                className="text-button"
                                                onClick={() => void refresh()}
                                            >
                                                Re-read files
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section
                                className="settings-section settings-section--danger"
                                aria-labelledby="settings-reset"
                            >
                                <div className="settings-label">
                                    <h2 id="settings-reset">Reset</h2>
                                    <p>
                                        Start over without touching your writing, or clear the app
                                        completely. Both actions reload Indigo.
                                    </p>
                                </div>

                                <div className="settings-card settings-reset-card">
                                    <div className="settings-danger-row">
                                        <div>
                                            <p className="settings-field-title">
                                                Reset the interface
                                            </p>
                                            <p className="settings-danger-copy">
                                                Clears the theme choice and window layout. Your
                                                notes, tags, and writing stay exactly as they are.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="button button--secondary button--small"
                                            onClick={() => setConfirmSoft(true)}
                                        >
                                            <RotateCcw size={14} />
                                            Reset interface
                                        </button>
                                    </div>

                                    <div className="settings-danger-row">
                                        <div>
                                            <p className="settings-field-title">
                                                Delete everything
                                            </p>
                                            <p className="settings-danger-copy">
                                                Deletes every note, tag, and setting on this
                                                computer. Indigo reopens as if it had just been
                                                installed. This cannot be undone.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="button button--danger button--small"
                                            onClick={() => setConfirmHard(true)}
                                        >
                                            <Trash2 size={14} />
                                            Delete everything
                                        </button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </DialogPanel>
                </div>
            </Dialog>

            <ConfirmDialog
                open={confirmSoft}
                title="Reset the interface?"
                description={
                    <>
                        Your theme and window layout will return to their defaults. Every note and
                        tag stays on this computer.
                    </>
                }
                confirmLabel="Reset interface"
                onClose={() => setConfirmSoft(false)}
                onConfirm={softReset}
            />

            <ConfirmDialog
                open={confirmHard}
                title="Delete everything?"
                description={
                    <>
                        Every note, tag, and setting will be deleted from this computer, and Indigo
                        will reopen as if it had just been installed. This cannot be undone.
                    </>
                }
                confirmLabel="Delete everything"
                tone="danger"
                onClose={() => setConfirmHard(false)}
                onConfirm={hardReset}
            />
        </>
    )
}
