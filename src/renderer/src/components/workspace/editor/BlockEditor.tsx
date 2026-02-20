import { codeBlockOptions } from '@blocknote/code-block'
import {
    Block,
    BlockNoteSchema,
    createCodeBlockSpec,
    createHeadingBlockSpec,
    defaultBlockSpecs,
    PartialBlock
} from '@blocknote/core'
import '@blocknote/core/fonts/inter.css'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import {
    blockTypeSelectItems,
    FormattingToolbar,
    FormattingToolbarController,
    useCreateBlockNote
} from '@blocknote/react'
import React from 'react'
import { Note } from 'src/shared/model/note'
import { twMerge } from 'tailwind-merge'

interface BlockEditorType extends React.HTMLAttributes<HTMLDivElement> {
    className?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateNoteBody: React.RefObject<any>
    note: Note
    isTrashOpened: boolean
}

const theme = {
    light: {
        colors: {
            editor: {
                text: '#2b323b',
                background: '#ffffff'
            }
        }
    },
    dark: {
        colors: {
            editor: {
                text: '#f3f4f6',
                background: '#0f0f12'
            }
        }
    }
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

const sanitizeBlocks = (blocks: Block[] | PartialBlock[]): PartialBlock[] => {
    return blocks.map((block) => {
        const partialBlock: PartialBlock = { ...block }

        if (partialBlock.type === 'heading' && partialBlock.props) {
            const level = partialBlock.props.level as number
            if (level === 1 || level === 2) {
                partialBlock.props = {
                    ...partialBlock.props,
                    level: 3
                }
            }
        }

        if (partialBlock.children && partialBlock.children.length > 0) {
            partialBlock.children = sanitizeBlocks(partialBlock.children as Block[])
        }

        return partialBlock
    })
}

const isBlocksEmpty = (blocks: PartialBlock[]): boolean => {
    return blocks.every((block) => {
        const childrenEmpty = block.children
            ? isBlocksEmpty(block.children as PartialBlock[])
            : true

        let contentEmpty = true

        if (Array.isArray(block.content)) {
            contentEmpty = block.content.length === 0
        } else if (typeof block.content === 'object' && block.content !== null) {
            contentEmpty = false
        }

        return contentEmpty && childrenEmpty
    })
}

export default function BlockEditor({
    className,
    updateNoteBody,
    note,
    isTrashOpened
}: BlockEditorType): React.JSX.Element {
    const editor = useCreateBlockNote(
        {
            schema,
            initialContent: note.body ? (JSON.parse(note.body) as PartialBlock[]) : undefined
        },
        [note.id]
    )

    const filteredBlockTypeItems = React.useMemo(() => {
        if (!editor) return []
        return blockTypeSelectItems(editor.dictionary).filter((item) => {
            if (item.type === 'heading' && (item.props?.level === 1 || item.props?.level === 2)) {
                return false
            }

            const hiddenNames = [
                'Heading 1',
                'Heading 2',
                'Heading 1 (Toggle)',
                'Heading 2 (Toggle)'
            ]
            if (hiddenNames.includes(item.name)) {
                return false
            }

            return true
        })
    }, [editor])

    if (!editor) {
        return <></>
    }

    return (
        <BlockNoteView
            formattingToolbar={false}
            editable={!isTrashOpened}
            key={note.id}
            className={twMerge(
                `bg-light-background dark:bg-dark-background z-40 overflow-y-auto`,
                className
            )}
            editor={editor}
            theme={theme}
            autoFocus
            onChange={() => {
                if (isTrashOpened) return

                const currentDoc = editor.document
                const cleanDoc = sanitizeBlocks(currentDoc)

                const empty = isBlocksEmpty(cleanDoc)
                updateNoteBody.current(note.id, empty ? '' : JSON.stringify(cleanDoc))
            }}
        >
            <FormattingToolbarController
                formattingToolbar={(props) => (
                    <FormattingToolbar {...props} blockTypeSelectItems={filteredBlockTypeItems} />
                )}
            />
        </BlockNoteView>
    )
}
