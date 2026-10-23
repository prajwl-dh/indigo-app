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
import type { ResolvedTheme, Theme } from '../../../shared/model/theme'
import { useToast } from './toast'

type AppearanceContextValue = {
    theme: Theme
    resolved: ResolvedTheme
    ready: boolean
    setTheme: (theme: Theme) => Promise<void>
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

const THEME_KEY = 'indigo:theme'

function systemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function rememberTheme(theme: Theme): void {
    try {
        window.localStorage.setItem(THEME_KEY, theme)
    } catch {
        // Remembering the boot theme is a nicety; storage can be unavailable.
    }
}

export function AppearanceProvider({ children }: { children: ReactNode }): JSX.Element {
    const { pushError } = useToast()
    const [theme, setThemeState] = useState<Theme>('system')
    const [resolved, setResolved] = useState<ResolvedTheme>(systemTheme)
    const [ready, setReady] = useState(false)

    const themeRef = useRef(theme)

    useEffect(() => {
        themeRef.current = theme
    }, [theme])

    useEffect(() => {
        let active = true

        const unsubscribe = window.indigo.theme.onChanged((change) => {
            if (!active) return
            themeRef.current = change.theme
            setThemeState(change.theme)
            setResolved(change.resolved)
            rememberTheme(change.theme)
        })

        const load = async (): Promise<void> => {
            try {
                const savedTheme = await window.indigo.theme.get()
                if (!active) return

                themeRef.current = savedTheme
                setThemeState(savedTheme)
                setResolved(savedTheme === 'system' ? systemTheme() : savedTheme)
                rememberTheme(savedTheme)
            } catch (error) {
                pushError(error, 'Could not read your appearance settings.')
            } finally {
                if (active) setReady(true)
            }
        }

        void load()

        return () => {
            active = false
            unsubscribe()
        }
    }, [pushError])

    useEffect(() => {
        if (theme !== 'system') return

        const media = window.matchMedia('(prefers-color-scheme: dark)')
        const update = (): void => setResolved(media.matches ? 'dark' : 'light')

        update()
        media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [theme])

    useEffect(() => {
        const root = document.documentElement
        root.dataset.theme = resolved
        root.style.colorScheme = resolved
    }, [resolved])

    const setTheme = useCallback(
        async (next: Theme): Promise<void> => {
            const previous = themeRef.current
            const previousResolved = resolved
            const nextResolved = next === 'system' ? systemTheme() : next

            themeRef.current = next
            setThemeState(next)
            setResolved(nextResolved)
            rememberTheme(next)

            try {
                await window.indigo.theme.set(next)
            } catch (error) {
                themeRef.current = previous
                setThemeState(previous)
                setResolved(previousResolved)
                throw error
            }
        },
        [resolved]
    )

    const value = useMemo(
        () => ({ theme, resolved, ready, setTheme }),
        [theme, resolved, ready, setTheme]
    )

    return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance(): AppearanceContextValue {
    const context = useContext(AppearanceContext)
    if (!context) throw new Error('useAppearance must be used inside AppearanceProvider')
    return context
}
