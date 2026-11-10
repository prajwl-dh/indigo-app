# Indigo

<p align="center">
  <img src="https://raw.githubusercontent.com/prajwl-dh/indigo-app/refs/heads/main/resources/indigo.png" alt="Indigo notes workspace" />
</p>

> A quiet, local-first notes workspace with a block editor, tags, and a paper-and-ink shell.

Indigo is a desktop notes app for macOS, Windows, and Linux. Notes are plain JSON files in `~/.indigo`, so there is no account, server, or sync service.

## Features

- **Block editor.** Headings, lists, checklists, quotes, code blocks, tables, images, and per-note colors.
- **Tags, pins, and trash.** Organise without folders; restore or permanently delete when you mean it.
- **Quick switcher.** Press `⌘P` (`Ctrl+P`) to jump to a note by title or run a command.
- **Find and replace.** Press `⌘F` inside a note; move between matches, match case, or replace all.
- **Search that answers questions.** Use `tag:`, `title:`, `body:`, `is:`, `has:`, `before:`, `after:`, quotes, and `-` negation. The `?` beside the search field lists every operator.
- **Saved searches.** Turn the current query into a smart view in the sidebar.
- **Wiki links and backlinks.** Type `[[` to link another note; every note linking to the one you are reading appears under **Linked from**.
- **Multi-select.** Select several notes to favourite, pin, trash, restore, or delete them together.
- **Copy and export.** Choose Text, Markdown, or HTML from the Copy and Export menus. Exports land in Downloads; copy as HTML keeps rich formatting.
- **Tasks across the library.** Every checklist item in one view; ticking one writes back to its note.
- **Focus mode.** The page alone, with a quiet way back.
- **Autosave you can trust.** Atomic writes, a short debounce, and save handshakes before switching notes, quitting, or installing an update.

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

Everything lives in `~/.indigo`:

```
~/.indigo
├── config.json   theme, window state, saved searches
└── notes         one JSON file per note, plus _tags.json
```

- Writes are atomic and queued. Indigo waits for a pending save before switching views, quitting, or installing an update.
- The folder is never uploaded anywhere. Keep your own backup by copying `~/.indigo` while Indigo is closed.
- **Settings → Library** shows the exact path, storage health, and **Open folder**.
- **Delete everything** removes only files Indigo recognises as notes, tags, and settings. Unknown files and backups stay put.

## Development

Requires Node.js 24 or newer.

```bash
npm ci
npm run dev
```

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e   # builds, then launches Electron
```

The end-to-end suite uses a temporary `INDIGO_DATA_DIR`, so it never touches your real library. On Linux it needs a display (CI uses `xvfb-run`).
