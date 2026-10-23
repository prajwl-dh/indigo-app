import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { useState, type JSX, type ReactNode } from 'react'
import { messageFromError } from '../lib/errors'

type ConfirmDialogProps = {
    open: boolean
    title: string
    description: ReactNode
    confirmLabel: string
    onClose: () => void
    onConfirm: () => Promise<void> | void
    tone?: 'danger' | 'default'
}

export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    onClose,
    onConfirm,
    tone = 'default'
}: ConfirmDialogProps): JSX.Element {
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const close = (): void => {
        setPending(false)
        setError(null)
        onClose()
    }

    const confirm = async (): Promise<void> => {
        setPending(true)
        setError(null)
        try {
            await onConfirm()
            close()
        } catch (caught) {
            setError(messageFromError(caught, 'That did not work. Try again.'))
        } finally {
            setPending(false)
        }
    }

    return (
        <Dialog open={open} onClose={pending ? () => undefined : close} className="dialog">
            <DialogBackdrop transition className="dialog-backdrop" />
            <div className="dialog-viewport">
                <DialogPanel transition className="dialog-panel dialog-panel--confirm">
                    <DialogTitle className="dialog-title">{title}</DialogTitle>
                    <div className="dialog-description">{description}</div>
                    {error && (
                        <p className="form-error" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="dialog-actions">
                        <button
                            type="button"
                            className="button button--secondary"
                            onClick={close}
                            disabled={pending}
                            autoFocus
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className={`button ${tone === 'danger' ? 'button--danger' : 'button--primary'}`}
                            onClick={() => void confirm()}
                            disabled={pending}
                        >
                            {pending ? 'Working…' : confirmLabel}
                        </button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    )
}
