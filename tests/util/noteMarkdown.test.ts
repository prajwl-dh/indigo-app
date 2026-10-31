import { describe, expect, it } from 'vitest'
import { bodyToMarkdown } from '../../src/shared/util/noteMarkdown'

const text = (value: string): { type: 'text'; text: string; styles: object } => ({
    type: 'text',
    text: value,
    styles: {}
})

describe('bodyToMarkdown', () => {
    it('returns an empty string for empty and unreadable bodies', () => {
        expect(bodyToMarkdown('')).toBe('')
        expect(bodyToMarkdown(null)).toBe('')
        expect(bodyToMarkdown('not json')).toBe('')
        expect(bodyToMarkdown(JSON.stringify([]))).toBe('')
    })

    it('writes paragraphs and headings at their real level', () => {
        const body = JSON.stringify([
            { type: 'heading', props: { level: 3 }, content: [text('Preface')], children: [] },
            { type: 'paragraph', content: [text('Hello world')], children: [] }
        ])
        expect(bodyToMarkdown(body)).toBe('### Preface\n\nHello world\n')
    })

    it('keeps a bullet list together and nests children', () => {
        const body = JSON.stringify([
            { type: 'bulletListItem', content: [text('First')], children: [] },
            {
                type: 'bulletListItem',
                content: [text('Second')],
                children: [{ type: 'bulletListItem', content: [text('Second a')], children: [] }]
            }
        ])
        expect(bodyToMarkdown(body)).toBe('- First\n\n- Second\n  - Second a\n')
    })

    it('numbers a consecutive run of list items', () => {
        const body = JSON.stringify([
            { type: 'numberedListItem', content: [text('One')], children: [] },
            { type: 'numberedListItem', content: [text('Two')], children: [] },
            { type: 'paragraph', content: [text('Interrupting prose')], children: [] },
            { type: 'numberedListItem', content: [text('Restart')], children: [] }
        ])
        expect(bodyToMarkdown(body)).toBe('1. One\n\n2. Two\n\nInterrupting prose\n\n1. Restart\n')
    })

    it('writes checkboxes with their real state', () => {
        const body = JSON.stringify([
            {
                type: 'checkListItem',
                props: { checked: false },
                content: [text('Open')],
                children: []
            },
            {
                type: 'checkListItem',
                props: { checked: true },
                content: [text('Done')],
                children: []
            }
        ])
        expect(bodyToMarkdown(body)).toBe('- [ ] Open\n\n- [x] Done\n')
    })

    it('fences code blocks with their language', () => {
        const body = JSON.stringify([
            {
                type: 'codeBlock',
                props: { language: 'ts' },
                content: 'const answer = 42',
                children: []
            }
        ])
        expect(bodyToMarkdown(body)).toBe('```ts\nconst answer = 42\n```\n')
    })

    it('writes images with their caption and a divider as a rule', () => {
        const body = JSON.stringify([
            {
                type: 'image',
                props: { url: 'https://example.com/a.png', caption: 'A photograph' },
                children: []
            },
            { type: 'divider', props: {}, children: [] }
        ])
        expect(bodyToMarkdown(body)).toBe('![A photograph](https://example.com/a.png)\n\n---\n')
    })

    it('renders a table with a header row', () => {
        const body = JSON.stringify([
            {
                type: 'table',
                content: {
                    type: 'tableContent',
                    rows: [{ cells: [{ ...text('Day') }] }, { cells: [{ ...text('Monday') }] }]
                },
                children: []
            }
        ])
        expect(bodyToMarkdown(body)).toBe('Day\n---\nMonday\n')
    })
})
