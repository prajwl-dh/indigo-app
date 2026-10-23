import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { useEffect, useId, useRef, useState, type FormEvent, type JSX } from 'react'
import { MAX_TAG_LENGTH } from '../../../shared/util/tags'
import { messageFromError } from '../lib/errors'

type TagDialogProps = {
    open: boolean
    mode: 'create' | 'rename'
    initialName?: string
    onClose: () => void
    onSubmit: (name: string) => Promise<void>
}

export default function TagDialog({
    open,
    mode,
    initialName = '',
    onClose,
    onSubmit
}: TagDialogProps): JSX.Element {
    const inputId = useId()
    const inputRef = useRef<HTMLInputElement>(null)
    const [name, setName] = useState(initialName)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        const frame = window.requestAnimationFrame(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
        })
        return () => window.cancelAnimationFrame(frame)
    }, [open])

    const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault()
        const next = name.trim()
        if (!next) {
            setError('Give the tag a name first.')
            return
        }

        setPending(true)
        setError(null)
        try {
            await onSubmit(next)
            onClose()
        } catch (caught) {
            setError(messageFromError(caught, 'Could not save that tag.'))
        } finally {
            setPending(false)
        }
    }

    const creating = mode === 'create'

    return (
        <Dialog open={open} onClose={pending ? () => undefined : onClose} className="dialog">
            <DialogBackdrop transition className="dialog-backdrop" />
            <div className="dialog-viewport">
                <DialogPanel transition className="dialog-panel">
                    <DialogTitle className="dialog-title">
                        {creating ? 'New tag' : 'Rename tag'}
                    </DialogTitle>
                    <p className="dialog-description">
                        {creating
                            ? 'Tags are shared across every note in your library.'
                            : 'Every note using this tag will be updated.'}
                    </p>
                    <form onSubmit={(event) => void submit(event)} className="dialog-form">
                        <label className="field-label" htmlFor={inputId}>
                            Tag name
                        </label>
                        <input
                            ref={inputRef}
                            id={inputId}
                            className="text-input"
                            value={name}
                            maxLength={MAX_TAG_LENGTH}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="e.g. Research"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {error && (
                            <p className="form-error" role="alert">
                                {error}
                            </p>
                        )}
                        <div className="dialog-actions">
                            <button
                                type="button"
                                className="button button--secondary"
                                onClick={onClose}
                                disabled={pending}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="button button--primary"
                                disabled={pending || name.trim().length === 0}
                            >
                                {pending
                                    ? creating
                                        ? 'Creating…'
                                        : 'Renaming…'
                                    : creating
                                      ? 'Create tag'
                                      : 'Rename tag'}
                            </button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    )
}
