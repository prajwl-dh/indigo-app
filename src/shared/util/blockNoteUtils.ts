import { BlockNoteEditor, PartialBlock } from '@blocknote/core'

const editor = BlockNoteEditor.create()

export function convertBlockNoteToMarkdown(content: PartialBlock[] | undefined): string {
    const markdownResult = editor.blocksToMarkdownLossy(content)
    return markdownResult
}
