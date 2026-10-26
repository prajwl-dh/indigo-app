export type UpdateInstallMode = 'windows-installer' | 'mac-dmg' | 'linux-appimage' | 'manual'

export type UpdateAsset = {
    name: string
    url: string
    size: number
    sha256: string | null
}

export type UpdateCheckResult = {
    currentVersion: string
    latestVersion: string | null
    available: boolean
    releaseName: string | null
    releaseUrl: string
    publishedAt: string | null
    asset: UpdateAsset | null
    installMode: UpdateInstallMode
    canAutoInstall: boolean
    installNote: string | null
    checkedAt: string
    error: string | null
}

export type UpdateProgressPhase = 'downloading' | 'verifying' | 'ready' | 'installing'

export type UpdateProgress = {
    phase: UpdateProgressPhase
    receivedBytes: number
    totalBytes: number | null
    percent: number | null
}

export type UpdateDownloadResult = {
    version: string
    fileName: string
}

/**
 * Sent when a pending install is cancelled (the quit was cancelled or the
 * latest save could not be confirmed) or when the installer could not start.
 */
export type UpdateInstallState = {
    state: 'cancelled' | 'failed'
    message: string | null
}
