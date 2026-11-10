import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { useState, type JSX } from 'react'
import type { NoteTransferFormat } from '../../../shared/model/note'
import { messageFromError } from '../lib/errors'

type TransferDialogProps = {
    open: boolean
    mode: 'copy' | 'export'
    noteTitle: string
    onClose: () => void
    onChoose: (format: NoteTransferFormat) => Promise<void>
}

const FORMATS: Array<{
    format: NoteTransferFormat
    label: string
    extension: string
    description: string
}> = [
    {
        format: 'text',
        label: 'Text',
        extension: '.txt',
        description: 'The writing alone, with no formatting marks.'
    },
    {
        format: 'markdown',
        label: 'Markdown',
        extension: '.md',
        description: 'Headings, lists, quotes, and tables kept as Markdown.'
    },
    {
        format: 'html',
        label: 'HTML',
        extension: '.html',
        description: 'A formatted page that opens in any browser.'
    }
]

export default function TransferDialog({
    open,
    mode,
    noteTitle,
    onClose,
    onChoose
}: TransferDialogProps): JSX.Element {
    const [pending, setPending] = useState<NoteTransferFormat | null>(null)
    const [error, setError] = useState<string | null>(null)

    const copying = mode === 'copy'
    // HTML is a useful export target but not a useful clipboard format here.
    const formats = copying ? FORMATS.filter((option) => option.format !== 'html') : FORMATS

    const choose = async (format: NoteTransferFormat): Promise<void> => {
        setPending(format)
        setError(null)
        try {
            await onChoose(format)
            onClose()
        } catch (caught) {
            setError(messageFromError(caught, 'That did not work. Try again.'))
        } finally {
            setPending(null)
        }
    }

    return (
        <Dialog open={open} onClose={pending ? () => undefined : onClose} className="dialog">
            <DialogBackdrop transition className="dialog-backdrop" />
            <div className="dialog-viewport">
                <DialogPanel transition className="dialog-panel transfer-panel">
                    <DialogTitle className="dialog-title">
                        {copying ? 'Copy note' : 'Export note'}
                    </DialogTitle>
                    <p className="dialog-description">
                        {copying
                            ? `Choose the format for “${noteTitle}”.`
                            : `Choose a file format for “${noteTitle}”.`}
                    </p>

                    <div className="transfer-options">
                        {formats.map((option) => (
                            <button
                                key={option.format}
                                type="button"
                                className="transfer-option"
                                disabled={pending !== null}
                                onClick={() => void choose(option.format)}
                            >
                                <span className="transfer-option-text">
                                    <span className="transfer-option-label">{option.label}</span>
                                    <span className="transfer-option-description">
                                        {option.description}
                                    </span>
                                </span>
                                <span className="transfer-option-extension">
                                    {pending === option.format
                                        ? copying
                                            ? 'Copying…'
                                            : 'Exporting…'
                                        : option.extension}
                                </span>
                            </button>
                        ))}
                    </div>

                    {error && (
                        <p className="form-error" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="dialog-actions">
                        <button
                            type="button"
                            className="button button--secondary"
                            disabled={pending !== null}
                            onClick={onClose}
                            autoFocus
                        >
                            Cancel
                        </button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    )
}
