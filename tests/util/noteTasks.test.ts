import { describe, expect, it } from 'vitest'
import { extractTasks, setTaskChecked } from '../../src/shared/util/noteTasks'

const CHECKLIST_BODY = JSON.stringify([
    {
        id: 'item-1',
        type: 'checkListItem',
        props: { checked: false },
        content: [{ type: 'text', text: 'Milk', styles: {} }],
        children: []
    },
    {
        type: 'paragraph',
        content: [{ type: 'text', text: 'plain paragraph', styles: {} }],
        children: []
    },
    {
        id: 'item-2',
        type: 'checkListItem',
        props: { checked: true },
        content: [{ type: 'text', text: 'Eggs', styles: {} }],
        children: [
            {
                id: 'item-3',
                type: 'checkListItem',
                props: { checked: false },
                content: [{ type: 'text', text: 'Free range', styles: {} }],
                children: []
            }
        ]
    }
])

describe('extractTasks', () => {
    it('returns nothing for empty or unreadable bodies', () => {
        expect(extractTasks('')).toEqual([])
        expect(extractTasks(null)).toEqual([])
        expect(extractTasks('not json at all')).toEqual([])
    })

    it('collects checkbox items in reading order, nested ones included', () => {
        const tasks = extractTasks(CHECKLIST_BODY)
        expect(tasks).toEqual([
            { blockId: 'item-1', text: 'Milk', checked: false },
            { blockId: 'item-2', text: 'Eggs', checked: true },
            { blockId: 'item-3', text: 'Free range', checked: false }
        ])
    })

    it('skips checkbox items without text or a block id', () => {
        const body = JSON.stringify([
            {
                type: 'checkListItem',
                props: { checked: false },
                content: [],
                children: []
            },
            {
                type: 'checkListItem',
                props: { checked: false },
                content: [{ type: 'text', text: 'No id', styles: {} }],
                children: []
            }
        ])
        // An item without a saved id keeps its place in the document as its
        // identity, so it can still be ticked from the Tasks view.
        expect(extractTasks(body)).toEqual([{ blockId: 'ti:1', text: 'No id', checked: false }])
    })

    it('toggles an item that had no id in the saved document', () => {
        const body = JSON.stringify([
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'First', styles: {} }],
                children: []
            },
            {
                type: 'checkListItem',
                props: { checked: false },
                content: [{ type: 'text', text: 'Hand-added', styles: {} }],
                children: []
            }
        ])

        const next = setTaskChecked(body, 'ti:1', true)
        expect(next).not.toBeNull()
        expect(extractTasks(next ?? '')).toEqual([
            { blockId: 'ti:1', text: 'Hand-added', checked: true }
        ])
    })
})

describe('setTaskChecked', () => {
    it('flips one item and leaves the rest of the document untouched', () => {
        const next = setTaskChecked(CHECKLIST_BODY, 'item-1', true)
        expect(next).not.toBeNull()
        expect(extractTasks(next ?? '')).toEqual([
            { blockId: 'item-1', text: 'Milk', checked: true },
            { blockId: 'item-2', text: 'Eggs', checked: true },
            { blockId: 'item-3', text: 'Free range', checked: false }
        ])
    })

    it('reaches items nested inside other items', () => {
        const next = setTaskChecked(CHECKLIST_BODY, 'item-3', true)
        const tasks = extractTasks(next ?? '')
        expect(tasks.find((task) => task.blockId === 'item-3')?.checked).toBe(true)
    })

    it('returns null for a body without that block', () => {
        expect(setTaskChecked(CHECKLIST_BODY, 'missing', true)).toBeNull()
        expect(setTaskChecked('not json', 'missing', true)).toBeNull()
    })

    it('returns null when nothing would change', () => {
        expect(setTaskChecked(CHECKLIST_BODY, 'item-2', true)).toBeNull()
    })
})
