import { codeBlockOptions } from '@blocknote/code-block'
import {
    BlockNoteSchema,
    createCodeBlockSpec,
    createHeadingBlockSpec,
    defaultBlockSpecs,
    type Block,
    type PartialBlock
} from '@blocknote/core'
import { SuggestionMenu } from '@blocknote/core/extensions'
import '@blocknote/core/fonts/inter.css'
import { BlockNoteView, darkDefaultTheme, lightDefaultTheme } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import {
    blockTypeSelectItems,
    FormattingToolbar,
    FormattingToolbarController,
    SuggestionMenuController,
    useCreateBlockNote,
    type DefaultReactSuggestionItem
} from '@blocknote/react'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { FileText } from 'lucide-react'
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type JSX
} from 'react'
import type { Note } from '../../../../shared/model/note'
import type { ResolvedTheme } from '../../../../shared/model/theme'
import { noteHref, NOTE_LINK_PREFIX, noteIdFromHref } from '../../../../shared/util/noteLinks'
import { extractPlainText } from '../../../../shared/util/noteText'
import { useWorkspace } from '../../state/workspace'

export type FindResult = { count: number; index: number }

export type BlockEditorHandle = {
    focus: () => void
    isSuggestionMenuOpen: () => boolean
    find: (query: string, caseSensitive?: boolean) => FindResult
    findNext: () => FindResult
    findPrevious: () => FindResult
    replaceCurrent: (text: string) => FindResult
    replaceAll: (text: string) => FindResult
    clearFind: () => void
}

type BlockEditorProps = {
    noteId: string
    initialBody: string
    editable: boolean
    theme: ResolvedTheme
    onChange: (body: string) => void
}

const schema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        heading: createHeadingBlockSpec({
            levels: [3, 4, 5, 6]
        }),
        codeBlock: createCodeBlockSpec(codeBlockOptions)
    }
})

/* ------------------------------------------------------------------ */
/* Find and replace                                                    */
/* ------------------------------------------------------------------ */

type FindMatch = { from: number; to: number }

type FindState = {
    query: string
    caseSensitive: boolean
    matches: FindMatch[]
    activeIndex: number
    decorations: DecorationSet
}

type FindMeta = {
    query?: string
    caseSensitive?: boolean
    activeIndex?: number
    clear?: boolean
}

const FIND_KEY = new PluginKey<FindState>('indigo-find')

/**
 * BlockNote's own link guard, plus the Indigo scheme. It mirrors the editor's
 * default allow-list so enabling wiki links does not quietly change which web
 * addresses remain valid.
 */
const ALLOWED_LINK_URI =
    /^(?:(?:http|https|ftp|ftps|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z0-9+.-]+(?:[^a-z+.-:]|$))/i

function isAllowedLink(href: string): boolean {
    if (href.startsWith(NOTE_LINK_PREFIX)) return true
    return ALLOWED_LINK_URI.test(href.replace(/\s/gu, ''))
}

function findMatches(
    doc: import('@tiptap/pm/model').Node,
    query: string,
    caseSensitive: boolean
): FindMatch[] {
    const needle = caseSensitive ? query : query.toLocaleLowerCase()
    if (!needle) return []

    const matches: FindMatch[] = []
    doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return
        const text = caseSensitive ? node.text : node.text.toLocaleLowerCase()
        let offset = 0

        while (offset <= text.length - needle.length) {
            const found = text.indexOf(needle, offset)
            if (found === -1) break
            matches.push({ from: pos + found, to: pos + found + needle.length })
            offset = found + Math.max(1, needle.length)
        }
    })

    return matches
}

function decorationsFor(
    doc: import('@tiptap/pm/model').Node,
    matches: FindMatch[],
    activeIndex: number
): DecorationSet {
    if (matches.length === 0) return DecorationSet.empty

    return DecorationSet.create(
        doc,
        matches.map((match, index) =>
            Decoration.inline(match.from, match.to, {
                class: index === activeIndex ? 'find-match find-match--active' : 'find-match'
            })
        )
    )
}

function clampIndex(index: number, count: number): number {
    if (count === 0) return 0
    return ((index % count) + count) % count
}

function nextFindState(
    doc: import('@tiptap/pm/model').Node,
    previous: FindState,
    meta: FindMeta | undefined
): FindState {
    let query = previous.query
    let caseSensitive = previous.caseSensitive
    let activeIndex = previous.activeIndex

    if (meta) {
        if (meta.clear) {
            query = ''
            activeIndex = 0
        }
        if (meta.query !== undefined) {
            query = meta.query
            activeIndex = meta.activeIndex ?? 0
        }
        if (meta.caseSensitive !== undefined) {
            caseSensitive = meta.caseSensitive
            activeIndex = 0
        }
        if (meta.activeIndex !== undefined) activeIndex = meta.activeIndex
    }

    const matches = findMatches(doc, query, caseSensitive)
    const index = clampIndex(activeIndex, matches.length)

    return {
        query,
        caseSensitive,
        matches,
        activeIndex: index,
        decorations: decorationsFor(doc, matches, index)
    }
}

const findPlugin = new Plugin<FindState>({
    key: FIND_KEY,
    state: {
        init: () => ({
            query: '',
            caseSensitive: false,
            matches: [],
            activeIndex: 0,
            decorations: DecorationSet.empty
        }),
        apply(transaction, previous) {
            const meta = transaction.getMeta(FIND_KEY) as FindMeta | undefined
            if (!transaction.docChanged && !meta) return previous
            return nextFindState(transaction.doc, previous, meta)
        }
    },
    props: {
        decorations(state) {
            return FIND_KEY.getState(state)?.decorations
        }
    }
})

/* ------------------------------------------------------------------ */
/* Document helpers                                                    */
/* ------------------------------------------------------------------ */

function sanitizeBlocks(blocks: Block[] | PartialBlock[]): PartialBlock[] {
    return blocks.map((block) => {
        const partialBlock: PartialBlock = { ...block }

        if (partialBlock.type === 'heading' && partialBlock.props) {
            const level = partialBlock.props.level as number
            if (level === 1 || level === 2) {
                partialBlock.props = { ...partialBlock.props, level: 3 }
            }
        }

        if (partialBlock.children && partialBlock.children.length > 0) {
            partialBlock.children = sanitizeBlocks(partialBlock.children)
        }

        return partialBlock
    })
}

function isBlocksEmpty(blocks: PartialBlock[]): boolean {
    return blocks.every((block) => {
        const childrenEmpty = block.children ? isBlocksEmpty(block.children) : true

        let contentEmpty = true
        if (Array.isArray(block.content)) {
            contentEmpty = block.content.length === 0
        } else if (typeof block.content === 'object' && block.content !== null) {
            contentEmpty = false
        }

        return contentEmpty && childrenEmpty
    })
}

function parseInitialContent(body: string): PartialBlock[] | undefined {
    if (!body.trim()) return undefined
    try {
        const parsed = JSON.parse(body) as unknown
        if (!Array.isArray(parsed)) return undefined
        return sanitizeBlocks(parsed as PartialBlock[])
    } catch {
        return undefined
    }
}

function serializeDocument(blocks: Block[]): string {
    const clean = sanitizeBlocks(blocks)
    return isBlocksEmpty(clean) ? '' : JSON.stringify(clean)
}

type NoteSuggestion = DefaultReactSuggestionItem & { noteId: string }

const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(function BlockEditor(
    { noteId, initialBody, editable, theme, onChange },
    ref
): JSX.Element {
    const { notes, openNote } = useWorkspace()
    const [initialContent] = useState(() => parseInitialContent(initialBody))

    const notesRef = useRef<Note[]>(notes)
    const openNoteRef = useRef(openNote)

    useEffect(() => {
        notesRef.current = notes
        openNoteRef.current = openNote
    }, [notes, openNote])

    const editor = useCreateBlockNote(
        {
            schema,
            initialContent,
            links: {
                HTMLAttributes: { class: 'indigo-note-link' },
                isValidLink: isAllowedLink,
                onClick: (event) => {
                    const target = event.target as HTMLElement | null
                    const href = target?.closest('a')?.getAttribute('href') ?? null
                    if (!href) return false

                    const linkedId = noteIdFromHref(href)
                    if (linkedId) {
                        event.preventDefault()
                        void openNoteRef.current(linkedId)
                        return true
                    }

                    if (/^(https?|mailto|tel):/i.test(href)) {
                        event.preventDefault()
                        window.open(href, '_blank', 'noopener,noreferrer')
                        return true
                    }

                    return false
                }
            }
        },
        [noteId]
    )

    useEffect(() => {
        if (!editor) return
        const tiptap = editor._tiptapEditor
        tiptap.registerPlugin(findPlugin)
        return () => {
            try {
                tiptap.unregisterPlugin(FIND_KEY)
            } catch {
                // The editor may already be gone; nothing is left to clean up.
            }
        }
    }, [editor])

    const insertNoteLink = (id: string, title: string): void => {
        if (!editor) return
        try {
            editor.getExtension(SuggestionMenu)?.clearQuery()
        } catch {
            // The menu is optional; inserting the link still works without it.
        }

        editor.insertInlineContent([
            {
                type: 'link',
                href: noteHref(id),
                content: title.trim() || 'Untitled note'
            },
            { type: 'text', text: ' ', styles: {} }
        ])
        editor.focus()
    }

    const getNoteLinkItems = async (query: string): Promise<NoteSuggestion[]> => {
        const needle = query.trim().toLowerCase()
        const matches = notesRef.current
            .filter((note) => !note.isInTrash && note.id !== noteId)
            .filter((note) => {
                if (!needle) return true
                if (note.title.toLowerCase().includes(needle)) return true
                return extractPlainText(note.body).toLowerCase().includes(needle)
            })
            .slice(0, 8)

        return matches.map((note) => ({
            noteId: note.id,
            title: note.title.trim() || 'Untitled note',
            subtext: extractPlainText(note.body).slice(0, 60) || 'Empty note',
            icon: <FileText size={14} />,
            onItemClick: () => insertNoteLink(note.id, note.title)
        }))
    }

    const view = useCallback(
        (): import('@tiptap/pm/view').EditorView | null => editor?._tiptapEditor?.view ?? null,
        [editor]
    )

    const currentFind = useCallback((): FindResult => {
        const currentView = view()
        const state = currentView ? FIND_KEY.getState(currentView.state) : undefined
        return { count: state?.matches.length ?? 0, index: state?.activeIndex ?? 0 }
    }, [view])

    const revealActiveMatch = useCallback((): void => {
        const currentView = view()
        if (!currentView) return
        const state = FIND_KEY.getState(currentView.state)
        const match = state?.matches[state.activeIndex]
        if (!match) return

        currentView.dispatch(
            currentView.state.tr
                .setSelection(TextSelection.create(currentView.state.doc, match.from, match.to))
                .scrollIntoView()
        )
    }, [view])

    const setFind = useCallback(
        (meta: FindMeta): FindResult => {
            const currentView = view()
            if (!currentView) return { count: 0, index: 0 }
            currentView.dispatch(currentView.state.tr.setMeta(FIND_KEY, meta))
            revealActiveMatch()
            return currentFind()
        },
        [currentFind, revealActiveMatch, view]
    )

    useImperativeHandle(
        ref,
        () => ({
            focus: () => editor?.focus(),
            // The slash menu puts its trigger in the document while the writer
            // is choosing. Title derivation has to know the menu is still open,
            // or "/" is read as content.
            isSuggestionMenuOpen: () => {
                if (!editor) return false
                try {
                    return editor.getExtension(SuggestionMenu)?.shown() ?? false
                } catch {
                    return false
                }
            },
            find: (query: string, caseSensitive = false) => setFind({ query, caseSensitive }),
            findNext: () => {
                const current = currentFind()
                return setFind({ activeIndex: current.index + 1 })
            },
            findPrevious: () => {
                const current = currentFind()
                return setFind({ activeIndex: current.index - 1 })
            },
            replaceCurrent: (text: string) => {
                const currentView = view()
                if (!currentView) return { count: 0, index: 0 }
                const state = FIND_KEY.getState(currentView.state)
                const match = state?.matches[state.activeIndex]
                if (!match) return currentFind()

                currentView.dispatch(currentView.state.tr.insertText(text, match.from, match.to))
                revealActiveMatch()
                return currentFind()
            },
            replaceAll: (text: string) => {
                const currentView = view()
                if (!currentView) return { count: 0, index: 0 }
                const state = FIND_KEY.getState(currentView.state)
                if (!state || state.matches.length === 0) return { count: 0, index: 0 }

                const transaction = currentView.state.tr
                // Work backwards so earlier positions keep their meaning.
                for (let index = state.matches.length - 1; index >= 0; index -= 1) {
                    const match = state.matches[index]
                    transaction.insertText(text, match.from, match.to)
                }
                transaction.setMeta(FIND_KEY, { activeIndex: 0 })
                currentView.dispatch(transaction)
                return currentFind()
            },
            clearFind: () => {
                setFind({ clear: true })
            }
        }),
        [editor, currentFind, revealActiveMatch, setFind, view]
    )

    const appTheme = useMemo(() => {
        const base = theme === 'dark' ? darkDefaultTheme : lightDefaultTheme

        return {
            ...base,
            fontFamily: 'var(--font-ui)',
            borderRadius: 6,
            colors: {
                ...base.colors,
                editor: { text: 'var(--ink)', background: 'transparent' },
                menu: { text: 'var(--ink)', background: 'var(--raised)' },
                tooltip: { text: 'var(--ink)', background: 'var(--surface)' },
                hovered: { text: 'var(--ink)', background: 'var(--hover)' },
                selected: { text: 'var(--ink)', background: 'var(--field)' },
                disabled: { text: 'var(--faint)', background: 'var(--field)' },
                shadow: 'color-mix(in srgb, var(--ink) 12%, transparent)',
                border: 'var(--line)',
                sideMenu: 'var(--faint)'
            }
        }
    }, [theme])

    const filteredBlockTypeItems = useMemo(() => {
        if (!editor) return []
        return blockTypeSelectItems(editor.dictionary).filter((item) => {
            const level = (item.props as { level?: number } | undefined)?.level
            if (item.type === 'heading' && (level === 1 || level === 2)) return false

            const hiddenNames = [
                'Heading 1',
                'Heading 2',
                'Heading 1 (Toggle)',
                'Heading 2 (Toggle)'
            ]
            return !hiddenNames.includes(item.name)
        })
    }, [editor])

    if (!editor) return <></>

    return (
        <BlockNoteView
            editor={editor}
            theme={appTheme}
            editable={editable}
            formattingToolbar={false}
            className="block-editor"
            onChange={() => {
                if (!editable) return
                onChange(serializeDocument(editor.document))
            }}
        >
            <FormattingToolbarController
                formattingToolbar={(props) => (
                    <FormattingToolbar {...props} blockTypeSelectItems={filteredBlockTypeItems} />
                )}
            />
            <SuggestionMenuController
                triggerCharacter="[["
                minQueryLength={0}
                getItems={getNoteLinkItems}
                onItemClick={(item) => insertNoteLink(item.noteId, item.title)}
            />
        </BlockNoteView>
    )
})

export default BlockEditor
