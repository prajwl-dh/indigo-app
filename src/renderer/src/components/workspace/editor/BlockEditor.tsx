import { codeBlockOptions } from '@blocknote/code-block'
import { BlockNoteSchema, createCodeBlockSpec, PartialBlock } from '@blocknote/core'
import '@blocknote/core/fonts/inter.css'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { useCreateBlockNote } from '@blocknote/react'
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

export default function BlockEditor({
    className,
    updateNoteBody,
    note,
    isTrashOpened
}: BlockEditorType): React.JSX.Element {
    const editor = useCreateBlockNote(
        {
            schema: BlockNoteSchema.create().extend({
                blockSpecs: {
                    codeBlock: createCodeBlockSpec(codeBlockOptions)
                }
            }),
            initialContent: note.body ? (JSON.parse(note.body) as PartialBlock[]) : undefined
        },
        [note.id]
    )

    if (!editor) {
        return <></>
    }

    return (
        <BlockNoteView
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
                updateNoteBody.current(note.id, JSON.stringify(editor.document))
            }}
        />
    )
}
