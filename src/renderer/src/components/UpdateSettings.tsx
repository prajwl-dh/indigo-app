import { Download, RefreshCw } from 'lucide-react'
import type { JSX } from 'react'
import { formatReleaseDate } from '../lib/format'
import { useUpdates } from '../state/updates'
import { useWorkspace } from '../state/workspace'
import UpdateMeter from './UpdateMeter'

export default function UpdateSettings(): JSX.Element {
    const {
        version,
        info,
        checking,
        checkError,
        download,
        checkForUpdates,
        startDownload,
        installUpdate,
        openRelease
    } = useUpdates()
    const { saveNow } = useWorkspace()

    const currentVersion = info?.currentVersion || version
    const available = info?.available === true
    const manual = available && info?.canAutoInstall === false
    const downloading = download.status === 'downloading' || download.status === 'verifying'
    const verifying = download.status === 'verifying'
    const ready = download.status === 'ready'
    const installing = download.status === 'installing'
    const published = info?.publishedAt ? formatReleaseDate(info.publishedAt) : ''

    const status = installing
        ? 'Restarting…'
        : ready
          ? 'Ready to install'
          : downloading
            ? download.status === 'verifying'
                ? 'Checking download'
                : 'Downloading'
            : checking
              ? 'Checking…'
              : checkError
                ? 'Could not check'
                : available
                  ? 'Update available'
                  : info
                    ? 'Up to date'
                    : 'Not checked yet'

    let copy: string
    if (checkError) {
        copy = checkError
    } else if (download.error) {
        copy = download.error
    } else if (ready) {
        copy = `Indigo ${download.version ?? info?.latestVersion ?? ''} is downloaded. Restart Indigo to close it, install the update, and reopen. Your notes stay where they are.`
    } else if (verifying) {
        copy = 'Indigo is checking the download before installing it.'
    } else if (downloading) {
        copy = 'Keep Indigo open while the update downloads.'
    } else if (available && manual) {
        copy =
            info?.installNote ??
            'Download the new version from the release page, then install it as you did the first time.'
    } else if (available) {
        copy = `Indigo ${info?.latestVersion ?? ''} is available. Download it here, then restart Indigo to finish. Your notes stay where they are.`
    } else if (info) {
        copy = 'You are on the latest release. Indigo checks again the next time it opens.'
    } else {
        copy = 'Indigo checks for a newer release when it opens.'
    }

    const restartAndInstall = async (): Promise<void> => {
        await saveNow()
        await installUpdate()
    }

    return (
        <section className="settings-section" aria-labelledby="settings-updates">
            <div className="settings-label">
                <h2 id="settings-updates">Updates</h2>
                <p>
                    Indigo checks GitHub for a newer release when it opens. Your notes never leave
                    this computer.
                </p>
            </div>

            <div className="settings-card">
                <div className="settings-field">
                    <div className="settings-field-head">
                        <span className="settings-field-title">Indigo {currentVersion || '…'}</span>
                        <span className="settings-field-value">{status}</span>
                    </div>

                    <p
                        className={`settings-update-copy${
                            checkError || download.error ? ' settings-update-copy--error' : ''
                        }`}
                    >
                        {copy}
                    </p>

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

                    <div className="settings-actions">
                        {ready || installing ? (
                            <button
                                type="button"
                                className="button button--primary button--small"
                                onClick={() => void restartAndInstall()}
                                disabled={installing}
                            >
                                <Download size={14} />
                                {installing ? 'Restarting…' : 'Restart and install'}
                            </button>
                        ) : manual ? (
                            <button
                                type="button"
                                className="button button--primary button--small"
                                onClick={() => void openRelease()}
                            >
                                View release
                            </button>
                        ) : available ? (
                            <button
                                type="button"
                                className="button button--primary button--small"
                                onClick={() => void startDownload()}
                                disabled={downloading || installing}
                            >
                                <Download size={14} />
                                {downloading
                                    ? download.status === 'verifying'
                                        ? 'Checking…'
                                        : 'Downloading…'
                                    : download.error
                                      ? 'Try again'
                                      : 'Download update'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="button button--secondary button--small"
                                onClick={() => void checkForUpdates(true)}
                                disabled={checking || downloading || installing}
                            >
                                <RefreshCw size={14} />
                                {checking ? 'Checking…' : 'Check for updates'}
                            </button>
                        )}

                        {available && !manual && (
                            <button
                                type="button"
                                className="text-button"
                                onClick={() => void openRelease()}
                            >
                                Release notes
                            </button>
                        )}
                    </div>

                    {published && !downloading && !installing && (
                        <p className="settings-update-note">Published {published}</p>
                    )}
                </div>
            </div>
        </section>
    )
}
