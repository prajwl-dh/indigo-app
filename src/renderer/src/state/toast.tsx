import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type JSX,
    type ReactNode
} from 'react'
import { X } from 'lucide-react'
import { messageFromError } from '../lib/errors'

type ToastTone = 'neutral' | 'error'

type ToastAction = {
    label: string
    run: () => void | Promise<void>
}

type ToastOptions = {
    tone?: ToastTone
    action?: ToastAction
    duration?: number
}

type ToastItem = {
    id: number
    message: string
    tone: ToastTone
    action?: ToastAction
}

type ToastContextValue = {
    push: (message: string, options?: ToastOptions) => void
    pushError: (error: unknown, fallback?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
    const [toasts, setToasts] = useState<ToastItem[]>([])
    const nextId = useRef(1)
    const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

    const dismiss = useCallback((id: number): void => {
        const timer = timers.current.get(id)
        if (timer) clearTimeout(timer)
        timers.current.delete(id)
        setToasts((current) => current.filter((toast) => toast.id !== id))
    }, [])

    const push = useCallback(
        (message: string, options?: ToastOptions): void => {
            const text = message.trim()
            if (!text) return

            const id = nextId.current
            nextId.current += 1
            const tone = options?.tone ?? 'neutral'

            setToasts((current) => [
                ...current.slice(-2),
                { id, message: text, tone, action: options?.action }
            ])

            const timer = setTimeout(
                () => dismiss(id),
                options?.duration ?? (options?.action ? 7000 : 4200)
            )
            timers.current.set(id, timer)
        },
        [dismiss]
    )

    const pushError = useCallback(
        (error: unknown, fallback = 'Something went wrong.'): void => {
            push(messageFromError(error, fallback), { tone: 'error' })
        },
        [push]
    )

    useEffect(() => {
        const pending = timers.current
        return () => {
            for (const timer of pending.values()) clearTimeout(timer)
            pending.clear()
        }
    }, [])

    const value = useMemo(() => ({ push, pushError }), [push, pushError])

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="toast-region" aria-live="polite" aria-atomic="false">
                {toasts.map((toast) => (
                    <div className={`toast toast--${toast.tone}`} key={toast.id} role="status">
                        <span className="toast-message">{toast.message}</span>
                        {toast.action && (
                            <button
                                type="button"
                                className="toast-action"
                                onClick={() => {
                                    dismiss(toast.id)
                                    void toast.action?.run()
                                }}
                            >
                                {toast.action.label}
                            </button>
                        )}
                        <button
                            type="button"
                            className="toast-close"
                            aria-label="Dismiss notification"
                            onClick={() => dismiss(toast.id)}
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast(): ToastContextValue {
    const context = useContext(ToastContext)
    if (!context) throw new Error('useToast must be used inside ToastProvider')
    return context
}
