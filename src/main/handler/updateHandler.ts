import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { constants, promises as fs, createReadStream, createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { app, BrowserWindow, ipcMain, net, shell } from 'electron'
import type {
    UpdateAsset,
    UpdateCheckResult,
    UpdateDownloadResult,
    UpdateInstallMode,
    UpdateProgress
} from '../../shared/model/update'

const execFileAsync = promisify(execFile)

const REPO = 'prajwl-dh/indigo-app'
const RELEASES_PAGE = `https://github.com/${REPO}/releases`
const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`
const DOWNLOAD_DIRECTORY = join(tmpdir(), 'indigo-update')
const CHECK_CACHE_MS = 5 * 60 * 1000
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000
const STALE_DOWNLOAD_MS = 60 * 60 * 1000

type GitHubAsset = UpdateAsset

type GitHubRelease = {
    tag: string
    name: string | null
    url: string
    publishedAt: string | null
    assets: GitHubAsset[]
}

type InstallPlan = {
    mode: UpdateInstallMode
    canAutoInstall: boolean
    note: string | null
}

type DownloadedUpdate = {
    filePath: string
    version: string
    asset: UpdateAsset
}

let cachedCheck: { at: number; result: UpdateCheckResult } | null = null
let latestInfo: UpdateCheckResult | null = null
let downloadedUpdate: DownloadedUpdate | null = null
let downloadTask: Promise<UpdateDownloadResult> | null = null

export function registerUpdateHandlers(): void {
    void cleanWindowsDownloads()

    ipcMain.handle('updates:version', () => app.getVersion())

    ipcMain.handle('updates:check', async (_event, force: unknown) =>
        checkForUpdate(force === true)
    )

    ipcMain.handle('updates:download', () => downloadUpdate())

    ipcMain.handle('updates:install', () => installUpdate())

    ipcMain.handle('updates:open-release', () => openReleasePage())
}

function emitProgress(progress: UpdateProgress): void {
    for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send('updates:progress', progress)
    }
}

function errorText(error: unknown): string {
    if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
            return 'GitHub took too long to answer. Check your connection and try again.'
        }
        if (error.message.startsWith('GitHub')) return error.message
    }
    return 'Could not reach GitHub. Check your connection and try again.'
}

function logError(context: string, error: unknown): void {
    console.error(`[updates] ${context}`, error)
}

function parseVersion(value: string): { core: number[]; prerelease: string[] } | null {
    const cleaned = value.trim().replace(/^v/i, '').split('+')[0]
    if (!cleaned) return null

    const separator = cleaned.indexOf('-')
    const coreText = separator === -1 ? cleaned : cleaned.slice(0, separator)
    const prereleaseText = separator === -1 ? '' : cleaned.slice(separator + 1)
    const core = coreText.split('.').map((part) => Number(part))

    if (core.length === 0 || core.some((part) => !Number.isInteger(part) || part < 0)) return null

    return {
        core,
        prerelease: prereleaseText ? prereleaseText.split('.') : []
    }
}

function compareVersions(left: string, right: string): number {
    const a = parseVersion(left)
    const b = parseVersion(right)
    if (!a || !b) return 0

    const length = Math.max(a.core.length, b.core.length)
    for (let index = 0; index < length; index += 1) {
        const difference = (a.core[index] ?? 0) - (b.core[index] ?? 0)
        if (difference !== 0) return difference > 0 ? 1 : -1
    }

    if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0
    if (a.prerelease.length === 0) return 1
    if (b.prerelease.length === 0) return -1

    const identifiers = Math.max(a.prerelease.length, b.prerelease.length)
    for (let index = 0; index < identifiers; index += 1) {
        const leftPart = a.prerelease[index]
        const rightPart = b.prerelease[index]
        if (leftPart === undefined) return -1
        if (rightPart === undefined) return 1
        if (leftPart === rightPart) continue

        const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null
        const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null

        if (leftNumber !== null && rightNumber !== null) return leftNumber > rightNumber ? 1 : -1
        if (leftNumber !== null) return -1
        if (rightNumber !== null) return 1
        return leftPart > rightPart ? 1 : -1
    }

    return 0
}

function isNewer(candidate: string, current: string): boolean {
    return compareVersions(candidate, current) > 0
}

function readDigest(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!/^sha256:[a-f0-9]{64}$/i.test(trimmed)) return null
    return trimmed.slice('sha256:'.length).toLowerCase()
}

function readAssets(value: unknown): GitHubAsset[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const asset = entry as Record<string, unknown>
        if (typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string') {
            return []
        }

        return [
            {
                name: asset.name,
                url: asset.browser_download_url,
                size: typeof asset.size === 'number' && asset.size > 0 ? asset.size : 0,
                sha256: readDigest(asset.digest)
            }
        ]
    })
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
    const response = await net.fetch(LATEST_RELEASE_API, {
        headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': `Indigo/${app.getVersion()}`,
            'X-GitHub-Api-Version': '2022-11-28'
        },
        signal: AbortSignal.timeout(15_000)
    })

    if (!response.ok) {
        throw new Error(
            response.status === 403
                ? 'GitHub is limiting update checks right now. Try again later.'
                : `GitHub answered with status ${response.status}.`
        )
    }

    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') {
        throw new Error('GitHub sent an unexpected response.')
    }

    const release = payload as Record<string, unknown>
    if (typeof release.tag_name !== 'string' || typeof release.html_url !== 'string') {
        throw new Error('GitHub sent an unexpected response.')
    }

    return {
        tag: release.tag_name,
        name: typeof release.name === 'string' ? release.name : null,
        url: release.html_url,
        publishedAt: typeof release.published_at === 'string' ? release.published_at : null,
        assets: readAssets(release.assets)
    }
}

function fetchLatestTagFromRedirect(): Promise<string | null> {
    return new Promise((resolve) => {
        let settled = false
        const request = net.request({
            url: `${RELEASES_PAGE}/latest`,
            redirect: 'manual'
        })

        const finish = (tag: string | null): void => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(tag)
        }

        const timer = setTimeout(() => {
            finish(null)
            request.abort()
        }, 10_000)
        timer.unref()

        request.on('redirect', (_status, _method, redirectUrl) => {
            const match = /\/releases\/tag\/([^/?#]+)/.exec(redirectUrl)
            finish(match ? decodeURIComponent(match[1]) : null)
            request.abort()
        })
        request.on('response', (response) => {
            response.on('error', () => finish(null))
            response.on('data', () => undefined)
            response.on('end', () => finish(null))
        })
        request.on('error', () => finish(null))
        request.setHeader('User-Agent', `Indigo/${app.getVersion()}`)
        request.end()
    })
}

function matchesPlatform(assetName: string): boolean {
    const name = assetName.toLowerCase()
    const architecture = process.arch

    if (process.platform === 'win32') {
        if (!name.endsWith('.exe')) return false
        if (!name.includes('setup') && !name.includes('installer')) return false

        // Release assets are renamed (Indigo-v1.0.2-Windows-x64-Setup.exe) while a
        // local electron-builder build is named indigo-1.0.2-x64-setup.exe, so match
        // on either the platform or the architecture part of the name.
        return (
            name.includes('windows') ||
            name.includes('win32') ||
            name.includes('x64') ||
            name.includes('amd64') ||
            name.includes('x86_64')
        )
    }

    if (process.platform === 'darwin') {
        if (!name.endsWith('.dmg')) return false
        if (architecture === 'arm64') {
            return name.includes('apple-silicon') || name.includes('arm64')
        }
        return name.includes('intel') || name.includes('x64') || name.includes('x86_64')
    }

    if (process.platform === 'linux') {
        if (!name.endsWith('.appimage')) return false
        if (architecture === 'arm64') {
            return name.includes('arm64') || name.includes('aarch64')
        }
        return name.includes('x64') || name.includes('x86_64') || name.includes('amd64')
    }

    return false
}

function selectAsset(assets: GitHubAsset[]): UpdateAsset | null {
    return assets.find((asset) => matchesPlatform(asset.name)) ?? null
}

async function isWritable(path: string): Promise<boolean> {
    try {
        await fs.access(path, constants.W_OK)
        return true
    } catch {
        return false
    }
}

function macBundlePath(): string | null {
    const parts = app.getPath('exe').split('/')
    for (let index = parts.length - 1; index >= 0; index -= 1) {
        if (parts[index].endsWith('.app')) return parts.slice(0, index + 1).join('/')
    }
    return null
}

async function appImagePath(): Promise<string | null> {
    const value = process.env.APPIMAGE
    if (!value) return null
    try {
        return await fs.realpath(value)
    } catch {
        return value
    }
}

async function resolveInstallPlan(asset: UpdateAsset | null): Promise<InstallPlan> {
    if (!app.isPackaged) {
        return {
            mode: 'manual',
            canAutoInstall: false,
            note: 'This development build cannot install updates itself. Open the release page to download a build.'
        }
    }

    if (!asset) {
        return {
            mode: 'manual',
            canAutoInstall: false,
            note: 'No build for this computer was found in the release. Open the release page to choose one.'
        }
    }

    if (process.platform === 'win32') {
        return { mode: 'windows-installer', canAutoInstall: true, note: null }
    }

    if (process.platform === 'darwin') {
        const bundle = macBundlePath()
        if (!bundle) {
            return {
                mode: 'manual',
                canAutoInstall: false,
                note: 'Indigo could not find its application folder. Open the release page to download the update.'
            }
        }

        if (bundle.startsWith('/Volumes/') || bundle.includes('/AppTranslocation/')) {
            return {
                mode: 'manual',
                canAutoInstall: false,
                note: 'Indigo is running from a disk image. Move it to Applications, then check again.'
            }
        }

        if (!(await isWritable(dirname(bundle)))) {
            return {
                mode: 'manual',
                canAutoInstall: false,
                note: 'Indigo cannot replace itself in this folder. Open the release page to download the update.'
            }
        }

        return { mode: 'mac-dmg', canAutoInstall: true, note: null }
    }

    if (process.platform === 'linux') {
        const appImage = await appImagePath()
        if (!appImage) {
            return {
                mode: 'manual',
                canAutoInstall: false,
                note: 'Indigo was not started from an AppImage. Open the release page to download the update.'
            }
        }

        if (!(await isWritable(dirname(appImage))) || !(await isWritable(appImage))) {
            return {
                mode: 'manual',
                canAutoInstall: false,
                note: 'Indigo cannot replace this AppImage. Open the release page to download the update.'
            }
        }

        return { mode: 'linux-appimage', canAutoInstall: true, note: null }
    }

    return {
        mode: 'manual',
        canAutoInstall: false,
        note: 'Open the release page to download the update for this computer.'
    }
}

function safeReleaseUrl(value: string): string {
    return /^https:\/\/github\.com\/prajwl-dh\/indigo-app\/releases(?:\/|$)/.test(value)
        ? value
        : RELEASES_PAGE
}

function emptyResult(currentVersion: string, error: string | null): UpdateCheckResult {
    return {
        currentVersion,
        latestVersion: null,
        available: false,
        releaseName: null,
        releaseUrl: RELEASES_PAGE,
        publishedAt: null,
        asset: null,
        installMode: 'manual',
        canAutoInstall: false,
        installNote: null,
        checkedAt: new Date().toISOString(),
        error
    }
}

async function checkForUpdate(force: boolean): Promise<UpdateCheckResult> {
    const currentVersion = app.getVersion()

    if (!force && cachedCheck && Date.now() - cachedCheck.at < CHECK_CACHE_MS) {
        latestInfo = cachedCheck.result
        return cachedCheck.result
    }

    try {
        const release = await fetchLatestRelease()
        const latestVersion = release.tag.replace(/^v/i, '')
        const available = isNewer(latestVersion, currentVersion)
        const asset = available ? selectAsset(release.assets) : null
        const plan = available
            ? await resolveInstallPlan(asset)
            : { mode: 'manual' as const, canAutoInstall: false, note: null }

        const result: UpdateCheckResult = {
            currentVersion,
            latestVersion,
            available,
            releaseName: release.name ?? release.tag,
            releaseUrl: safeReleaseUrl(release.url),
            publishedAt: release.publishedAt,
            asset,
            installMode: plan.mode,
            canAutoInstall: plan.canAutoInstall,
            installNote: plan.note,
            checkedAt: new Date().toISOString(),
            error: null
        }

        cachedCheck = { at: Date.now(), result }
        latestInfo = result
        if (!available || downloadedUpdate?.version !== latestVersion) downloadedUpdate = null
        return result
    } catch (error) {
        logError('check failed', error)

        try {
            const fallbackTag = await fetchLatestTagFromRedirect()
            const fallbackVersion = fallbackTag?.replace(/^v/i, '') ?? null

            if (fallbackVersion) {
                const available = isNewer(fallbackVersion, currentVersion)
                const result: UpdateCheckResult = {
                    currentVersion,
                    latestVersion: fallbackVersion,
                    available,
                    releaseName: fallbackTag,
                    releaseUrl: safeReleaseUrl(
                        `${RELEASES_PAGE}/tag/${encodeURIComponent(fallbackTag ?? fallbackVersion)}`
                    ),
                    publishedAt: null,
                    asset: null,
                    installMode: 'manual',
                    canAutoInstall: false,
                    installNote: available
                        ? 'GitHub is busy right now. Open the release page to download this version.'
                        : null,
                    checkedAt: new Date().toISOString(),
                    error: null
                }
                cachedCheck = { at: Date.now(), result }
                latestInfo = result
                return result
            }
        } catch (fallbackError) {
            logError('fallback check failed', fallbackError)
        }

        const result = emptyResult(currentVersion, errorText(error))
        latestInfo = result
        return result
    }
}

async function writeBody(
    body: ReadableStream<Uint8Array>,
    filePath: string,
    onChunk: (bytes: number) => void
): Promise<void> {
    const counter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            onChunk(chunk.length)
            callback(null, chunk)
        }
    })

    try {
        await pipeline(
            Readable.fromWeb(body as unknown as import('node:stream/web').ReadableStream),
            counter,
            createWriteStream(filePath)
        )
    } catch (error) {
        await fs.rm(filePath, { force: true })
        throw error
    }
}

async function sha256File(filePath: string): Promise<string> {
    const hash = createHash('sha256')
    await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(filePath)
        stream.on('error', reject)
        stream.on('data', (chunk) => hash.update(chunk))
        stream.on('end', resolve)
    })
    return hash.digest('hex')
}

function safeFileName(name: string): string {
    const cleaned = basename(name).replace(/[^a-zA-Z0-9._-]/g, '-')
    return cleaned || 'indigo-update'
}

async function downloadUpdate(): Promise<UpdateDownloadResult> {
    if (downloadTask) return downloadTask

    const task = (async (): Promise<UpdateDownloadResult> => {
        const info = latestInfo?.available ? latestInfo : await checkForUpdate(true)

        if (!info.available || !info.latestVersion || !info.asset) {
            throw new Error(info.installNote ?? 'No update is available to download.')
        }

        if (!info.canAutoInstall) {
            throw new Error(
                info.installNote ?? 'This build installs updates from the release page.'
            )
        }

        if (downloadedUpdate && downloadedUpdate.version === info.latestVersion) {
            return {
                version: downloadedUpdate.version,
                fileName: basename(downloadedUpdate.filePath)
            }
        }

        await fs.mkdir(DOWNLOAD_DIRECTORY, { recursive: true })
        const filePath = join(DOWNLOAD_DIRECTORY, safeFileName(info.asset.name))
        await fs.rm(filePath, { force: true })

        const totalBytes = info.asset.size > 0 ? info.asset.size : null
        let receivedBytes = 0
        let lastEmit = 0

        emitProgress({
            phase: 'downloading',
            receivedBytes: 0,
            totalBytes,
            percent: 0
        })

        const response = await net.fetch(info.asset.url, {
            redirect: 'follow',
            headers: { 'User-Agent': `Indigo/${app.getVersion()}` },
            signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
        })

        if (!response.ok || !response.body) {
            throw new Error(`The download failed with status ${response.status}.`)
        }

        const contentLength = Number(response.headers.get('content-length'))
        const expectedBytes =
            info.asset.size > 0
                ? info.asset.size
                : Number.isFinite(contentLength) && contentLength > 0
                  ? contentLength
                  : null

        await writeBody(response.body, filePath, (bytes) => {
            receivedBytes += bytes
            const now = Date.now()
            if (now - lastEmit < 100) return
            lastEmit = now
            emitProgress({
                phase: 'downloading',
                receivedBytes,
                totalBytes: expectedBytes,
                percent: expectedBytes
                    ? Math.min(99, Math.round((receivedBytes / expectedBytes) * 100))
                    : null
            })
        })

        if (expectedBytes !== null && receivedBytes < expectedBytes) {
            await fs.rm(filePath, { force: true })
            throw new Error('The download stopped before it finished. Try again.')
        }

        emitProgress({
            phase: 'verifying',
            receivedBytes,
            totalBytes: expectedBytes,
            percent: 100
        })

        if (info.asset.sha256) {
            const digest = await sha256File(filePath)
            if (digest.toLowerCase() !== info.asset.sha256) {
                await fs.rm(filePath, { force: true })
                throw new Error(
                    'The downloaded file did not match the release checksum. Try again or use the release page.'
                )
            }
        }

        downloadedUpdate = {
            filePath,
            version: info.latestVersion,
            asset: info.asset
        }

        emitProgress({
            phase: 'ready',
            receivedBytes,
            totalBytes: expectedBytes,
            percent: 100
        })

        return { version: info.latestVersion, fileName: basename(filePath) }
    })()

    downloadTask = task
    try {
        return await task
    } finally {
        downloadTask = null
    }
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`
}

async function spawnDetached(
    command: string,
    args: string[],
    options: { cwd?: string; windowsHide?: boolean } = {}
): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
            detached: true,
            stdio: 'ignore',
            cwd: tmpdir(),
            ...options
        })

        child.once('error', reject)
        child.once('spawn', () => {
            child.unref()
            resolve()
        })
    })
}

async function cleanWindowsDownloads(): Promise<void> {
    if (process.platform !== 'win32') return

    try {
        const entries = await fs.readdir(DOWNLOAD_DIRECTORY, { withFileTypes: true })
        const cutoff = Date.now() - STALE_DOWNLOAD_MS

        await Promise.all(
            entries.map(async (entry) => {
                const filePath = join(DOWNLOAD_DIRECTORY, entry.name)
                if (filePath === downloadedUpdate?.filePath) return

                try {
                    const stats = await fs.stat(filePath)
                    if (stats.mtimeMs > cutoff) return
                    await fs.rm(filePath, { recursive: entry.isDirectory(), force: true })
                } catch {
                    // The installer may still be running; it is cleaned up next launch.
                }
            })
        )
    } catch {
        // Nothing has been downloaded yet.
    }
}

async function installWindows(installerPath: string): Promise<void> {
    // The installer is launched directly, the way electron-updater does it. It is a
    // GUI process, so it keeps running after Indigo quits, waits for this process to
    // exit (--updated) and starts the new build again (--force-run).
    //
    // Do not route this through a detached powershell.exe helper: on Windows a
    // console host spawned from Electron with `detached: true` exits immediately
    // without running the script, which made the update silently do nothing.
    await fs.access(installerPath, constants.F_OK)
    await spawnDetached(installerPath, ['/S', '--updated', '--force-run'], {
        cwd: DOWNLOAD_DIRECTORY
    })
}

async function installMac(dmgPath: string): Promise<void> {
    const bundlePath = macBundlePath()
    if (!bundlePath) throw new Error('Indigo could not find its application folder.')

    const mountPoint = join(tmpdir(), `indigo-update-mount-${Date.now()}`)
    await fs.mkdir(mountPoint, { recursive: true })

    try {
        await execFileAsync(
            'hdiutil',
            ['attach', '-nobrowse', '-noautoopen', '-readonly', '-mountpoint', mountPoint, dmgPath],
            { timeout: 60_000 }
        )
    } catch (error) {
        logError('could not mount the downloaded disk image', error)
        await fs.rm(mountPoint, { recursive: true, force: true })
        throw new Error(
            'The downloaded disk image could not be opened. Try the release page instead.'
        )
    }

    let sourceApp: string | null = null
    try {
        const entries = await fs.readdir(mountPoint)
        const entry = entries.find((name) => name.endsWith('.app'))
        if (entry) sourceApp = join(mountPoint, entry)
    } catch (error) {
        logError('could not read the mounted disk image', error)
    }

    if (!sourceApp) {
        await execFileAsync('hdiutil', ['detach', mountPoint, '-quiet']).catch(() => {})
        await fs.rm(mountPoint, { recursive: true, force: true })
        throw new Error(
            'The downloaded disk image did not contain Indigo. Try the release page instead.'
        )
    }

    const scriptPath = join(DOWNLOAD_DIRECTORY, 'install-indigo.sh')
    const script = `#!/bin/sh
app_pid=${process.pid}
bundle=${shellQuote(bundlePath)}
source_app=${shellQuote(sourceApp)}
mount_point=${shellQuote(mountPoint)}
disk_image=${shellQuote(dmgPath)}

while kill -0 "$app_pid" 2>/dev/null; do
    sleep 0.5
done
sleep 1

next_app="$bundle.indigo-new"
previous_app="$bundle.indigo-old"
/bin/rm -rf "$next_app" "$previous_app"

if /usr/bin/ditto "$source_app" "$next_app"; then
    if /bin/mv "$bundle" "$previous_app"; then
        if /bin/mv "$next_app" "$bundle"; then
            /bin/rm -rf "$previous_app"
        else
            /bin/mv "$previous_app" "$bundle"
        fi
    else
        /bin/rm -rf "$next_app"
    fi
fi

/usr/bin/xattr -dr com.apple.quarantine "$bundle" 2>/dev/null
/usr/bin/hdiutil detach "$mount_point" -quiet 2>/dev/null || /usr/bin/hdiutil detach "$mount_point" -force -quiet 2>/dev/null
/bin/rmdir "$mount_point" 2>/dev/null
/bin/rm -f "$disk_image"
/usr/bin/open "$bundle"
`

    await fs.writeFile(scriptPath, script, 'utf8')
    await fs.chmod(scriptPath, 0o755)

    try {
        await spawnDetached('/bin/sh', [scriptPath])
    } catch (error) {
        logError('could not start the macOS installer helper', error)
        await execFileAsync('hdiutil', ['detach', mountPoint, '-quiet']).catch(() => {})
        await fs.rm(mountPoint, { recursive: true, force: true })
        throw new Error('The update helper could not start. Try the release page instead.')
    }
}

async function installLinux(downloadPath: string): Promise<void> {
    const target = await appImagePath()
    if (!target) throw new Error('Indigo was not started from an AppImage.')

    const scriptPath = join(DOWNLOAD_DIRECTORY, 'install-indigo.sh')
    const script = `#!/bin/sh
app_pid=${process.pid}
target=${shellQuote(target)}
download=${shellQuote(downloadPath)}

while kill -0 "$app_pid" 2>/dev/null; do
    sleep 0.5
done
sleep 0.5

next_app="$target.indigo-new"
if /bin/cp "$download" "$next_app" && /bin/chmod 755 "$next_app" && /bin/mv "$next_app" "$target"; then
    /bin/rm -f "$download"
fi
/bin/rm -f "$next_app"
/usr/bin/nohup "$target" >/dev/null 2>&1 &
`

    await fs.writeFile(scriptPath, script, 'utf8')
    await fs.chmod(scriptPath, 0o755)
    await spawnDetached('/bin/sh', [scriptPath])
}

async function installUpdate(): Promise<void> {
    if (!downloadedUpdate) throw new Error('Download the update first.')
    if (!latestInfo?.latestVersion || downloadedUpdate.version !== latestInfo.latestVersion) {
        throw new Error('The downloaded update is out of date. Check for updates again.')
    }

    emitProgress({
        phase: 'installing',
        receivedBytes: downloadedUpdate.asset.size,
        totalBytes: downloadedUpdate.asset.size > 0 ? downloadedUpdate.asset.size : null,
        percent: 100
    })

    if (process.platform === 'win32') {
        await installWindows(downloadedUpdate.filePath)
    } else if (process.platform === 'darwin') {
        await installMac(downloadedUpdate.filePath)
    } else if (process.platform === 'linux') {
        await installLinux(downloadedUpdate.filePath)
    } else {
        throw new Error('Indigo cannot install updates on this platform.')
    }

    setTimeout(() => app.quit(), 250)
}

async function openReleasePage(): Promise<void> {
    await shell.openExternal(safeReleaseUrl(latestInfo?.releaseUrl ?? RELEASES_PAGE))
}
