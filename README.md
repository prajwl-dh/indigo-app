# Indigo

<p align="center">
  <img src="https://raw.githubusercontent.com/prajwl-dh/indigo-app/refs/heads/main/resources/indigo.png" alt="Indigo notes workspace" />
</p>

> A quiet, local-first notes workspace with a block editor, tags, and a paper-and-ink shell.

Indigo is a desktop notes app for macOS, Windows, and Linux. Notes are plain JSON files in `~/.indigo`, so there is no account, server, or sync service.

## Features

- **Block editor.** Headings, lists, checklists, quotes, code blocks, tables, images, and per-note colours.
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

## Install

Download the latest build from [Releases](https://github.com/prajwl-dh/indigo-app/releases).

- **macOS:** open the `.dmg` and drag Indigo to Applications. The app is unsigned, so run `xattr -cr /Applications/Indigo.app` once if macOS blocks it.
- **Windows:** run the `.exe` installer. If SmartScreen appears, choose **More info → Run anyway**.
- **Linux:** make the `.AppImage` executable (`chmod +x Indigo*.AppImage`) and run it.

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

## Releases

`main` only accepts pull requests. To ship a version:

1. Bump `version` in `package.json` and commit it with the change.
2. Open the pull request and wait for the `verify-indigo` checks.
3. Merge. The `release-indigo` workflow repeats the checks, builds macOS (arm64 and x64), Windows, and Linux (x64 and arm64), and publishes a GitHub release tagged `v<version>`.

If a release run fails after packaging, use **Re-run failed jobs** rather than merging again.
