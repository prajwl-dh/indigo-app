import { codeBlockOptions } from '@blocknote/code-block'
import { BlockNoteSchema, createCodeBlockSpec, createHeadingBlockSpec, defaultBlockSpecs, type Block, type PartialBlock } from '@blocknote/core'
import { SuggestionMenu } from '@blocknote/core/extensions'
import '@blocknote/core/fonts/inter.css'
import { BlockNoteView, darkDefaultTheme, lightDefaultTheme } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import {
    blockTypeSelectItems,
    FormattingToolbar,
    FormattingToolbarController,
    useCreateBlockNote
} from '@blocknote/react'
import { forwardRef, useImperativeHandle, useMemo, useState, type JSX } from 'react'
import type { ResolvedTheme } from '../../../../shared/model/theme'

export type BlockEditorHandle = {
    focus: () => void
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
    const [initialContent] = useState(() => parseInitialContent(initialBody))

    const editor = useCreateBlockNote(
        {
            schema,
            initialContent
        },
        [noteId]
    )

    useImperativeHandle(
        ref,
        () => ({
            focus: () => editor?.focus()
        }),
        [editor]
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
        </BlockNoteView>
    )
})

export default BlockEditor
