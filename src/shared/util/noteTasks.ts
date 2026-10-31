import type { PartialBlock } from '@blocknote/core'

type UnknownRecord = Record<string, unknown>

export type NoteTask = {
    blockId: string
    text: string
    checked: boolean
}

function inlineText(content: unknown): string {
    if (Array.isArray(content)) return content.map(inlineText).join('')
    if (!content || typeof content !== 'object') return ''
    const value = content as UnknownRecord
    if (typeof value.text === 'string') return value.text
    return inlineText(value.content)
}

/**
 * Blocks saved outside the editor (restored or hand-edited files) can lack an
 * id. Their place in the document is just as stable, so it becomes the
 * identifier instead: the same walk finds the item again when a checkbox is
 * ticked, and the write gives the block a real id for the future.
 */
function idOf(record: UnknownRecord, path: number[]): string {
    if (typeof record.id === 'string' && record.id) return record.id
    return `ti:${path.join('-')}`
}

type TaskVisitor = (task: NoteTask) => void

function walk(blocks: unknown, path: number[], visit: TaskVisitor): void {
    if (!Array.isArray(blocks)) return

    blocks.forEach((block, index) => {
        if (!block || typeof block !== 'object') return
        const record = block as UnknownRecord
        const blockPath = [...path, index]

        if (record.type === 'checkListItem') {
            const text = inlineText(record.content).replace(/\s+/g, ' ').trim()
            if (text) {
                const props = record.props as UnknownRecord | undefined
                visit({
                    blockId: idOf(record, blockPath),
                    text,
                    checked: props?.checked === true
                })
            }
        }

        walk(record.children, blockPath, visit)
    })
}

/**
 * Collects every checkbox item from a saved BlockNote document, in reading
 * order. Items without text, or a body that does not parse, contribute
 * nothing. The returned block id is the handle the Tasks view uses to toggle
 * an item later.
 */
export function extractTasks(body: string | undefined | null): NoteTask[] {
    if (!body || body.trim() === '') return []

    let parsed: unknown
    try {
        parsed = JSON.parse(body)
    } catch {
        return []
    }

    const tasks: NoteTask[] = []
    walk(parsed, [], (task) => tasks.push(task))
    return tasks
}

/**
 * Returns the document with one checkbox flipped. The document is treated as
 * immutable: the original string is untouched and a body without that block
 * returns null so callers can fail loudly instead of guessing.
 */
export function setTaskChecked(body: string, blockId: string, checked: boolean): string | null {
    let blocks: PartialBlock[] | null = null
    try {
        const parsed = JSON.parse(body) as unknown
        if (Array.isArray(parsed)) blocks = parsed as PartialBlock[]
    } catch {
        return null
    }

    if (!blocks) return null

    let changed = false
    const apply = (list: PartialBlock[], path: number[]): void => {
        list.forEach((block, index) => {
            const blockPath = [...path, index]
            const source = block as UnknownRecord

            if (
                block.type === 'checkListItem' &&
                idOf(source, blockPath) === blockId &&
                (block.props as { checked?: boolean } | undefined)?.checked !== checked
            ) {
                // Given a real id so the next tick matches the saved document.
                if (!block.id) block.id = blockId
                block.props = { ...(block.props ?? {}), checked }
                changed = true
            }

            if (block.children) apply(block.children as PartialBlock[], blockPath)
        })
    }
    apply(blocks, [])

    return changed ? JSON.stringify(blocks) : null
}
