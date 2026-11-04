import { describe, expect, it } from 'vitest'
import {
    extractNoteLinkIds,
    extractNoteLinks,
    noteHref,
    noteIdFromHref
} from '../../src/shared/util/noteLinks'

const text = (value: string): { type: 'text'; text: string; styles: object } => ({
    type: 'text',
    text: value,
    styles: {}
})

const link = (id: string, label: string): Record<string, unknown> => ({
    type: 'link',
    href: noteHref(id),
    content: [text(label)]
})

describe('note link hrefs', () => {
    it('round-trips a note id', () => {
        const href = noteHref('aa27a622-6b92-4009-8176-8c1cab6b590a')
        expect(href).toBe('indigo:note/aa27a622-6b92-4009-8176-8c1cab6b590a')
        expect(noteIdFromHref(href)).toBe('aa27a622-6b92-4009-8176-8c1cab6b590a')
    })

    it('encodes ids that need it', () => {
        expect(noteIdFromHref(noteHref('a b/c'))).toBe('a b/c')
    })

    it('ignores ordinary links and handles fragments', () => {
        expect(noteIdFromHref('https://example.com')).toBeNull()
        expect(noteIdFromHref(undefined)).toBeNull()
        expect(noteIdFromHref('indigo:note/abc?x=1')).toBe('abc')
    })
})

describe('extractNoteLinks', () => {
    it('finds nested links in children and tables, keeping the first label', () => {
        const body = JSON.stringify([
            {
                type: 'paragraph',
                content: [link('one', 'First link')],
                children: [
                    {
                        type: 'paragraph',
                        content: [link('two', 'Second link')],
                        children: []
                    }
                ]
            },
            {
                type: 'table',
                content: {
                    rows: [[[link('one', 'Duplicate')]], [[link('three', 'Third link')]]]
                },
                children: []
            },
            {
                type: 'paragraph',
                content: [text('No link here')],
                children: []
            }
        ])

        expect(extractNoteLinks(body)).toEqual([
            { noteId: 'one', text: 'First link' },
            { noteId: 'two', text: 'Second link' },
            { noteId: 'three', text: 'Third link' }
        ])
        expect(extractNoteLinkIds(body)).toEqual(['one', 'two', 'three'])
    })

    it('returns nothing for empty, malformed, or foreign documents', () => {
        expect(extractNoteLinks('')).toEqual([])
        expect(extractNoteLinks(null)).toEqual([])
        expect(extractNoteLinks('not json')).toEqual([])
        expect(
            extractNoteLinks(
                JSON.stringify([
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'link',
                                href: 'https://example.com',
                                content: [text('Web')]
                            }
                        ],
                        children: []
                    }
                ])
            )
        ).toEqual([])
    })
})
