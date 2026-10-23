import { useEffect, useState, type JSX } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'
import { isMac } from '../lib/platform'

export default function WindowControls(): JSX.Element | null {
    const [maximized, setMaximized] = useState(false)

    useEffect(() => {
        let active = true

        void window.indigo.window.isMaximized().then((value) => {
            if (active) setMaximized(value)
        })

        const unsubscribe = window.indigo.window.onMaximizedChanged((value) => {
            if (active) setMaximized(value)
        })

        return () => {
            active = false
            unsubscribe()
        }
    }, [])

    if (isMac) return null

    return (
        <div className="window-controls" aria-label="Window controls">
            <button
                type="button"
                className="window-control"
                aria-label="Minimize window"
                title="Minimize"
                onClick={() => void window.indigo.window.minimize()}
            >
                <Minus size={14} />
            </button>
            <button
                type="button"
                className="window-control"
                aria-label={maximized ? 'Restore window' : 'Maximize window'}
                title={maximized ? 'Restore' : 'Maximize'}
                onClick={() => void window.indigo.window.toggleMaximize()}
            >
                {maximized ? <Copy size={12} /> : <Square size={12} />}
            </button>
            <button
                type="button"
                className="window-control window-control--close"
                aria-label="Close window"
                title="Close"
                onClick={() => void window.indigo.window.close()}
            >
                <X size={15} />
            </button>
        </div>
    )
}
