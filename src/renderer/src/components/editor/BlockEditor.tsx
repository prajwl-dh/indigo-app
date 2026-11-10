import { codeBlockOptions } from '@blocknote/code-block'
import {
    BlockNoteSchema,
    createCodeBlockSpec,
    createHeadingBlockSpec,
    defaultBlockSpecs,
    type Block,
    type PartialBlock
} from '@blocknote/core'
import { filterSuggestionItems, SuggestionMenu } from '@blocknote/core/extensions'
import '@blocknote/core/fonts/inter.css'
import { BlockNoteView, darkDefaultTheme, lightDefaultTheme } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import {
    blockTypeSelectItems,
    FormattingToolbar,
    FormattingToolbarController,
    getDefaultReactSlashMenuItems,
    LinkToolbar,
    LinkToolbarController,
    SuggestionMenuController,
    useCreateBlockNote,
    type DefaultReactSuggestionItem,
    type FloatingUIOptions,
    type LinkToolbarProps
} from '@blocknote/react'
import { autoPlacement, offset, shift, size } from '@floating-ui/react'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Link2 } from 'lucide-react'
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
import { useWorkspace } from '../../state/workspace'
import NoteLinkDialog from './NoteLinkDialog'

export type FindResult = { count: number; index: number }

export type BlockEditorHandle = {
    focus: () => void
    /** Scrolls a block into view and flashes it. False until the editor exists. */
    revealBlock: (blockId: string) => boolean
    /** Ticks or unticks a checklist block in the live document. */
    setTaskChecked: (blockId: string, checked: boolean) => boolean
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

/**
 * BlockNote's default suggestion menu shrinks to whatever space is left
 * below the caret. Near the bottom of a long note that turns a full menu into
 * a one-line strip. The menu gets a stable viewport-based height instead, so
 * it scrolls internally and flips above the caret when it needs the room.
 */
const SUGGESTION_MENU_MAX_HEIGHT = 460

const slashMenuFloatingOptions: FloatingUIOptions = {
    useFloatingOptions: {
        middleware: [
            offset(10),
            autoPlacement({
                allowedPlacements: ['bottom-start', 'top-start'],
                padding: 10
            }),
            shift(),
            size({
                padding: 10,
                apply({ elements }) {
                    const viewport = window.visualViewport?.height ?? window.innerHeight
                    const height = Math.max(
                        240,
                        Math.min(SUGGESTION_MENU_MAX_HEIGHT, viewport - 24)
                    )
                    elements.floating.style.maxHeight = `${height}px`
                }
            })
        ]
    }
}

function isAllowedLink(href: string): boolean {
    if (href.startsWith(NOTE_LINK_PREFIX)) return true
    return ALLOWED_LINK_URI.test(href.replace(/\s/gu, ''))
}

/**
 * Note links open another page, so the link toolbar's edit, open-in-new-tab,
 * and remove actions do not belong on them. Other links keep the defaults.
 */
function NoteLinkToolbar({ url, ...props }: LinkToolbarProps): JSX.Element | null {
    if (noteIdFromHref(url)) return null
    return <LinkToolbar url={url} {...props} />
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

const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(function BlockEditor(
    { noteId, initialBody, editable, theme, onChange },
    ref
): JSX.Element {
    const { openNote } = useWorkspace()
    const [initialContent] = useState(() => parseInitialContent(initialBody))
    const [linkDialogOpen, setLinkDialogOpen] = useState(false)

    const openNoteRef = useRef(openNote)
    const linkSelectionRef = useRef<{ from: number; to: number } | null>(null)

    useEffect(() => {
        openNoteRef.current = openNote
    }, [openNote])

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

    const insertNoteLink = useCallback(
        (id: string, title: string): void => {
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
        },
        [editor]
    )

    /**
     * The slash menu removes its trigger before this runs. The caret position
     * it leaves behind is where the chosen link belongs, so it is kept until
     * the picker has made its choice.
     */
    const beginNoteLink = useCallback((): void => {
        if (!editor) return
        const selection = editor._tiptapEditor.state.selection
        linkSelectionRef.current = { from: selection.from, to: selection.to }
        setLinkDialogOpen(true)
    }, [editor])

    const closeLinkDialog = useCallback((): void => {
        setLinkDialogOpen(false)
        linkSelectionRef.current = null
        window.requestAnimationFrame(() => editor?.focus())
    }, [editor])

    const pickNoteLink = useCallback(
        (note: Note): void => {
            if (!editor) return
            const saved = linkSelectionRef.current
            if (saved) {
                const view = editor._tiptapEditor.view
                const from = Math.min(saved.from, view.state.doc.content.size)
                const to = Math.min(saved.to, view.state.doc.content.size)
                view.dispatch(
                    view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to))
                )
            }
            insertNoteLink(note.id, note.title)
            linkSelectionRef.current = null
        },
        [editor, insertNoteLink]
    )

    const getSlashMenuItems = useCallback(
        async (query: string): Promise<DefaultReactSuggestionItem[]> => {
            if (!editor) return []
            const items = getDefaultReactSlashMenuItems(editor)
            const linkItem: DefaultReactSuggestionItem = {
                title: 'Link to note',
                subtext: 'Link another note in this workspace',
                aliases: ['link', 'note', 'wiki', 'reference', 'connect'],
                group: 'Basic blocks',
                icon: <Link2 size={18} />,
                onItemClick: beginNoteLink
            }

            // Keep "Link to note" beside the other basic blocks instead of
            // starting a second group with the same name at the bottom.
            const lastBasic = items.reduce(
                (last, item, index) => (item.group === 'Basic blocks' ? index : last),
                -1
            )
            const insertAt = lastBasic === -1 ? items.length : lastBasic + 1
            const combined = [...items.slice(0, insertAt), linkItem, ...items.slice(insertAt)]

            return filterSuggestionItems(combined, query)
        },
        [beginNoteLink, editor]
    )

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

    const revealBlock = useCallback(
        (blockId: string): boolean => {
            const root = editor?.domElement
            if (!root) return false

            let frames = 0
            const scroll = (): void => {
                // BlockNote nests the block inside an outer wrapper that also
                // carries data-id; mark the block itself so the flash hugs the
                // content rather than the wrapper.
                const element =
                    root.querySelector<HTMLElement>(
                        `.bn-block[data-id="${CSS.escape(blockId)}"]`
                    ) ?? root.querySelector<HTMLElement>(`[data-id="${CSS.escape(blockId)}"]`)
                if (!element) {
                    // The note is still mounting its blocks; try the next frame.
                    frames += 1
                    if (frames <= 30) window.requestAnimationFrame(scroll)
                    return
                }

                element.scrollIntoView({ block: 'center', behavior: 'smooth' })
                // The editor re-renders blocks and strips classes, so the flash
                // is a Web Animation that lives on the node itself.
                element.getAnimations().forEach((animation) => animation.cancel())
                const flash =
                    getComputedStyle(document.documentElement).getPropertyValue('--hover').trim() ||
                    'rgba(0, 0, 0, 0.06)'
                element.animate(
                    [
                        { backgroundColor: flash, borderRadius: '6px' },
                        { backgroundColor: 'transparent', borderRadius: '6px' }
                    ],
                    { duration: 1600, easing: 'ease-out' }
                )
            }

            scroll()
            return true
        },
        [editor]
    )

    const setTaskChecked = useCallback(
        (blockId: string, checked: boolean): boolean => {
            if (!editor) return false
            const block = editor.getBlock(blockId)
            // A live editor owns the document: a missing block is stale task
            // state, not a reason to fall back to patching disk behind it.
            if (!block || block.type !== 'checkListItem') return true
            editor.updateBlock(blockId, { props: { checked } })
            return true
        },
        [editor]
    )

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
            revealBlock,
            setTaskChecked,
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
        [editor, currentFind, revealActiveMatch, revealBlock, setFind, setTaskChecked, view]
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
        <>
            <BlockNoteView
                editor={editor}
                theme={appTheme}
                editable={editable}
                formattingToolbar={false}
                linkToolbar={false}
                slashMenu={false}
                className="block-editor"
                onChange={() => {
                    if (!editable) return
                    onChange(serializeDocument(editor.document))
                }}
            >
                <FormattingToolbarController
                    formattingToolbar={(props) => (
                        <FormattingToolbar
                            {...props}
                            blockTypeSelectItems={filteredBlockTypeItems}
                        />
                    )}
                />
                <LinkToolbarController linkToolbar={NoteLinkToolbar} />
                <SuggestionMenuController
                    triggerCharacter="/"
                    getItems={getSlashMenuItems}
                    shouldOpen={(state) =>
                        !state.selection.$from.parent.type.isInGroup('tableContent')
                    }
                    floatingUIOptions={slashMenuFloatingOptions}
                />
            </BlockNoteView>

            <NoteLinkDialog
                open={linkDialogOpen}
                excludeNoteId={noteId}
                onClose={closeLinkDialog}
                onPick={pickNoteLink}
            />
        </>
    )
})

export default BlockEditor
