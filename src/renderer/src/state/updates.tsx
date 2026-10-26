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
import type { UpdateCheckResult } from '../../../shared/model/update'
import { messageFromError } from '../lib/errors'
import { useToast } from './toast'

type DownloadStatus = 'idle' | 'downloading' | 'verifying' | 'ready' | 'installing'

type DownloadState = {
    status: DownloadStatus
    version: string | null
    receivedBytes: number
    totalBytes: number | null
    percent: number | null
    error: string | null
}

type UpdateContextValue = {
    version: string
    info: UpdateCheckResult | null
    checking: boolean
    checkError: string | null
    download: DownloadState
    noticeDismissed: boolean
    checkForUpdates: (force?: boolean) => Promise<void>
    startDownload: () => Promise<void>
    installUpdate: () => Promise<void>
    openRelease: () => Promise<void>
    dismissNotice: () => void
}

const UpdateContext = createContext<UpdateContextValue | null>(null)

const idleDownload: DownloadState = {
    status: 'idle',
    version: null,
    receivedBytes: 0,
    totalBytes: null,
    percent: null,
    error: null
}

export function UpdateProvider({ children }: { children: ReactNode }): JSX.Element {
    const { pushError } = useToast()
    const [version, setVersion] = useState('')
    const [info, setInfo] = useState<UpdateCheckResult | null>(null)
    const [checking, setChecking] = useState(false)
    const [checkError, setCheckError] = useState<string | null>(null)
    const [download, setDownload] = useState<DownloadState>(idleDownload)
    const [noticeDismissed, setNoticeDismissed] = useState(false)
    const started = useRef(false)
    const downloadStarted = useRef(false)
    const installStarted = useRef(false)

    const openRelease = useCallback(async (): Promise<void> => {
        try {
            await window.indigo.updates.openRelease()
        } catch (error) {
            pushError(error, 'Could not open the release page.')
        }
    }, [pushError])

    const checkForUpdates = useCallback(async (force = false): Promise<void> => {
        setChecking(true)
        setCheckError(null)

        try {
            const result = await window.indigo.updates.check(force)
            setInfo(result)
            if (result.error) setCheckError(result.error)

            setDownload((current) => {
                if (
                    current.status === 'ready' &&
                    current.version &&
                    current.version !== result.latestVersion
                ) {
                    downloadStarted.current = false
                    installStarted.current = false
                    return idleDownload
                }
                return current
            })
        } catch (error) {
            setCheckError(messageFromError(error, 'Could not check for updates.'))
        } finally {
            setChecking(false)
        }
    }, [])

    useEffect(() => {
        if (started.current) return
        started.current = true

        void window.indigo.updates
            .getVersion()
            .then(setVersion)
            .catch(() => setVersion(''))
        void checkForUpdates(false)
    }, [checkForUpdates])

    useEffect(() => {
        return window.indigo.updates.onInstallState((state) => {
            // The quit flow cancelled the install (or the installer could not
            // start). Return to the ready state so it can be retried.
            installStarted.current = false
            const message =
                state.message ??
                (state.state === 'cancelled'
                    ? 'The update was cancelled.'
                    : 'The update could not be installed.')
            setDownload((current) => ({
                ...current,
                status: 'ready',
                error: message
            }))
            if (state.state === 'failed') pushError(message)
        })
    }, [pushError])

    useEffect(() => {
        return window.indigo.updates.onProgress((progress) => {
            setDownload((current) => {
                if (progress.phase === 'downloading') {
                    return {
                        status: 'downloading',
                        version: current.version,
                        receivedBytes: progress.receivedBytes,
                        totalBytes: progress.totalBytes,
                        percent: progress.percent,
                        error: null
                    }
                }

                if (progress.phase === 'verifying') {
                    return {
                        ...current,
                        status: 'verifying',
                        receivedBytes: progress.receivedBytes,
                        totalBytes: progress.totalBytes,
                        percent: 100,
                        error: null
                    }
                }

                if (progress.phase === 'ready') {
                    return {
                        ...current,
                        status: 'ready',
                        receivedBytes: progress.receivedBytes,
                        totalBytes: progress.totalBytes,
                        percent: 100,
                        error: null
                    }
                }

                if (progress.phase === 'installing') {
                    return { ...current, status: 'installing', percent: 100, error: null }
                }

                return current
            })
        })
    }, [])

    const startDownload = useCallback(async (): Promise<void> => {
        if (!info?.available || downloadStarted.current) return

        if (!info.canAutoInstall) {
            await openRelease()
            return
        }

        downloadStarted.current = true
        setDownload({
            status: 'downloading',
            version: info.latestVersion,
            receivedBytes: 0,
            totalBytes: info.asset?.size ?? null,
            percent: 0,
            error: null
        })

        try {
            const result = await window.indigo.updates.download()
            setDownload((current) => ({
                ...current,
                status: 'ready',
                version: result.version,
                percent: 100,
                error: null
            }))
        } catch (error) {
            downloadStarted.current = false
            const message = messageFromError(error, 'Could not download the update.')
            setDownload({ ...idleDownload, error: message })
            pushError(message)
        }
    }, [info, openRelease, pushError])

    const installUpdate = useCallback(async (): Promise<void> => {
        if (installStarted.current) return

        installStarted.current = true
        setDownload((current) => ({ ...current, status: 'installing', error: null }))

        try {
            await window.indigo.updates.install()
        } catch (error) {
            installStarted.current = false
            const message = messageFromError(error, 'Could not install the update.')
            setDownload((current) => ({ ...current, status: 'ready', error: message }))
            pushError(message)
        }
    }, [pushError])

    const dismissNotice = useCallback((): void => setNoticeDismissed(true), [])

    const value = useMemo(
        () => ({
            version,
            info,
            checking,
            checkError,
            download,
            noticeDismissed,
            checkForUpdates,
            startDownload,
            installUpdate,
            openRelease,
            dismissNotice
        }),
        [
            version,
            info,
            checking,
            checkError,
            download,
            noticeDismissed,
            checkForUpdates,
            startDownload,
            installUpdate,
            openRelease,
            dismissNotice
        ]
    )

    return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
}

export function useUpdates(): UpdateContextValue {
    const context = useContext(UpdateContext)
    if (!context) throw new Error('useUpdates must be used inside UpdateProvider')
    return context
}
