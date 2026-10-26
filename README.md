# Indigo

<p align="center">
  <img src="https://raw.githubusercontent.com/prajwl-dh/indigo-app/refs/heads/main/resources/indigo.png" alt="Indigo notes workspace" />
</p>

> A quiet, local-first notes workspace with a block editor, tags, and a paper-and-ink shell.

## Features

- **A real writing surface.** Notes use BlockNote's block editor, with headings, lists, checklists, quotes, code blocks, and tables.
- **Tags instead of folders.** Create a tag once, reuse it everywhere, rename it in place, and filter the library by any tag.
- **Local files, not a database.** Every note is a JSON file inside Indigo's own notes folder. There is no account, server, or sync service.
- **A calm shell.** Warm paper surfaces, serif note titles, a sidebar that folds into an icon rail, a search-first title bar, and custom window controls.
- **Light, dark, and system themes.** Per-note colours mark notes in the list and above the title without recolouring the whole app.
- **Autosave that never loses a keystroke.** Writes are atomic and queued; closing a note, switching views, or quitting flushes pending edits first.
- **Every note has a title.** A note written without one takes its opening words as the title, and an empty draft is discarded as soon as you leave it.
- **Trash with a safety net.** Move notes to trash, restore them, or delete them permanently after a confirmation.
- **Updates from GitHub.** Indigo checks for a newer release on launch, installs it in place on macOS, Windows, and Linux AppImage builds, and restarts without touching your notes.
- **A complete reset.** Settings can return Indigo to a first-launch state in one step.

## Installation Guide

### macOS (.dmg)

Indigo is not signed with an Apple Developer certificate, so macOS may block it the first time.

1. Download the `.dmg` for your Mac: **Apple Silicon** for M-series chips or **Intel** for older Macs.
2. Open the downloaded file and drag **Indigo** into **Applications**.
3. Open **Terminal** and run:

    ```bash
    xattr -cr /Applications/Indigo.app
    ```

4. Open Indigo from Applications. This is a one-time step.

### Windows (.exe)

The installer is not code-signed, so Windows SmartScreen may show a warning.

1. Download the `.exe` installer.
2. Run the installer.
3. If **Windows protected your PC** appears, choose **More info**, then **Run anyway**.
4. Finish the installation wizard.

### Linux (.AppImage)

1. Download the `.AppImage` for **x64** or **ARM64**.
2. Make it executable: right-click → **Properties** → **Permissions** → **Allow executing file as program**.
3. Double-click the file to run it.

## Your data

Indigo keeps everything in one visible folder in your home directory: `~/.indigo`.

```
~/.indigo
├── config.json   theme and window state
└── notes         one JSON file per note
```

The exact path for the current machine is shown in **Settings → Library**, and **Open folder** reveals it in your file manager.

- Notes live in `~/.indigo/notes`. Tags are kept in `~/.indigo/notes/_tags.json`.
- Writes are atomic, and files are never sent anywhere.
- Deleting the notes folder or using **Settings → Reset → Delete everything** removes every note, tag, and setting.
- Builds before this one kept notes and settings inside the system application-data folder. On first launch Indigo copies those files into `~/.indigo` and leaves the originals in place.
- Older Indigo versions stored notes in a `.indigo` SQLite database. That format is not imported automatically and those files are left untouched. Export anything you need from an older build before switching.

## Updates

Indigo checks GitHub for a newer release each time it opens. When one is available, a small notice appears in the corner with a link to the release notes and a download button.

On macOS, Windows, and Linux AppImage builds, Indigo downloads the matching build, verifies its SHA-256 checksum when GitHub provides one, closes, installs the update in place, and opens again. Pending edits are saved before the app closes, and notes in `~/.indigo` are never touched.

Indigo falls back to the release page when it cannot replace itself, including development builds, macOS builds running from a mounted disk image, Linux builds not started from an AppImage, and installs in folders it cannot write to. Settings → Updates shows the current version and the same download and release-page actions.

The check uses the public GitHub Releases API. It sends the app version in the request header and never sends note contents.

## Development

Requirements: Node.js 24 or newer.

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
```

The lockfile is committed, so CI uses `npm ci` and builds the same dependency tree you test locally.

## Releases

Update the version in `package.json`, commit, then run:

```bash
npm run release
```

That creates and pushes the matching `v*` tag. GitHub Actions verifies the project, builds macOS (Apple Silicon and Intel), Windows, and Linux (x64 and ARM64) artifacts, and publishes them as a draft-free GitHub release.
