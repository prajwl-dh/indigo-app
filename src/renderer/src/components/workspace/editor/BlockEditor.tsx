import { codeBlockOptions } from '@blocknote/code-block'
import { BlockNoteSchema, createCodeBlockSpec } from '@blocknote/core'
import '@blocknote/core/fonts/inter.css'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { useCreateBlockNote } from '@blocknote/react'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface BlockEditorType extends React.HTMLAttributes<HTMLDivElement> {
    className?: string
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

export default function BlockEditor({ className }: BlockEditorType): React.JSX.Element {
    const editor = useCreateBlockNote({
        schema: BlockNoteSchema.create().extend({
            blockSpecs: {
                codeBlock: createCodeBlockSpec(codeBlockOptions)
            }
        })
    })

    if (!editor) {
        return <></>
    }

    return (
        <BlockNoteView
            className={twMerge(
                `bg-light-background dark:bg-dark-background no-scrollbar z-40 overflow-y-auto`,
                className
            )}
            editor={editor}
            theme={theme}
            autoFocus
        />
    )
}
