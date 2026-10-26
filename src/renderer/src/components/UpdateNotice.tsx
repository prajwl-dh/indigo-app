import { X } from 'lucide-react'
import type { JSX } from 'react'
import { formatReleaseDate } from '../lib/format'
import { useUpdates } from '../state/updates'
import { useWorkspace } from '../state/workspace'
import UpdateMeter from './UpdateMeter'

export default function UpdateNotice(): JSX.Element | null {
    const {
        info,
        download,
        noticeDismissed,
        startDownload,
        installUpdate,
        openRelease,
        dismissNotice
    } = useUpdates()
    const { saveNow } = useWorkspace()

    if (!info?.available || noticeDismissed) return null

    const latest = info.latestVersion ?? ''
    const downloading = download.status === 'downloading' || download.status === 'verifying'
    const verifying = download.status === 'verifying'
    const ready = download.status === 'ready'
    const installing = download.status === 'installing'
    const manual = !info.canAutoInstall
    const published = info.publishedAt ? formatReleaseDate(info.publishedAt) : ''

    const title = installing
        ? 'Restarting Indigo…'
        : ready
          ? `Indigo ${download.version ?? latest} is ready`
          : verifying
            ? 'Checking the update'
            : downloading
              ? `Downloading Indigo ${latest}`
              : `Indigo ${latest} is available`

    let copy: string
    if (download.error) {
        copy = download.error
    } else if (installing) {
        copy = 'The update finishes installing while Indigo is closed.'
    } else if (ready) {
        copy =
            'Indigo will close, install the update, and reopen. Your notes stay exactly where they are.'
    } else if (verifying) {
        copy = 'Indigo is checking the download before installing it.'
    } else if (downloading) {
        copy = 'Keep Indigo open while the update downloads.'
    } else if (manual) {
        copy = info.installNote ?? 'Download the new version from the release page.'
    } else {
        copy = 'Download it now, then restart Indigo to finish. Your notes stay where they are.'
    }

    const restartAndInstall = async (): Promise<void> => {
        await saveNow()
        await installUpdate()
    }

    return (
        <aside className="update-notice" aria-label="Update available">
            <div className="update-notice-head">
                <div>
                    <h2 className="update-notice-title">{title}</h2>
                    <p
                        className={`update-notice-copy${
                            download.error ? ' update-notice-copy--error' : ''
                        }`}
                    >
                        {copy}
                    </p>
                </div>
                <button
                    type="button"
                    className="icon-button update-notice-close"
                    aria-label="Dismiss update notice"
                    title="Dismiss"
                    onClick={dismissNotice}
                >
                    <X size={15} />
                </button>
            </div>

            {downloading && (
                <UpdateMeter
                    receivedBytes={download.receivedBytes}
                    totalBytes={download.totalBytes}
                    percent={download.percent}
                    label={
                        download.status === 'verifying'
                            ? 'Checking the download'
                            : 'Downloading update'
                    }
                />
            )}

            {!installing && (
                <div className="update-notice-actions">
                    {ready ? (
                        <button
                            type="button"
                            className="button button--primary button--small"
                            onClick={() => void restartAndInstall()}
                        >
                            Restart and install
                        </button>
                    ) : downloading ? (
                        <span className="update-notice-wait" aria-live="polite">
                            {download.status === 'verifying'
                                ? 'Checking the download…'
                                : download.percent !== null
                                  ? `${Math.round(download.percent)}%`
                                  : 'Downloading…'}
                        </span>
                    ) : manual ? (
                        <button
                            type="button"
                            className="button button--primary button--small"
                            onClick={() => void openRelease()}
                        >
                            View release
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="button button--primary button--small"
                            onClick={() => void startDownload()}
                        >
                            {download.error ? 'Try again' : 'Download update'}
                        </button>
                    )}

                    {!manual && !downloading && !ready && (
                        <button
                            type="button"
                            className="text-button"
                            onClick={() => void openRelease()}
                        >
                            Release notes
                        </button>
                    )}
                </div>
            )}

            {published && !downloading && !ready && !installing && (
                <p className="update-notice-date">Published {published}</p>
            )}
        </aside>
    )
}
