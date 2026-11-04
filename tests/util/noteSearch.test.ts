import { describe, expect, it } from 'vitest'
import type { Note } from '../../src/shared/model/note'
import { noteMatchesSearch, parseSearch } from '../../src/shared/util/noteSearch'

const text = (value: string): { type: 'text'; text: string; styles: object } => ({
    type: 'text',
    text: value,
    styles: {}
})

function body(...paragraphs: string[]): string {
    return JSON.stringify(
        paragraphs.map((paragraph) => ({
            type: 'paragraph',
            content: [text(paragraph)],
            children: []
        }))
    )
}

function note(overrides: Partial<Note> = {}): Note {
    return {
        id: 'note-1',
        title: 'Quiet mornings',
        body: body('The paper and the ink.'),
        lastModified: '2026-03-15T10:00:00.000Z',
        createdAt: '2026-01-01T10:00:00.000Z',
        isFavorite: false,
        isInTrash: false,
        tags: ['journal'],
        color: null,
        ...overrides
    }
}

const matches = (query: string, target: Note): boolean =>
    noteMatchesSearch(target, parseSearch(query))

describe('parseSearch', () => {
    it('keeps a quoted phrase together and strips the quotes', () => {
        const parsed = parseSearch('"quiet mornings" -tag:archive')
        expect(parsed.conditions).toEqual([
            { type: 'text', field: 'any', value: 'quiet mornings', negated: false },
            { type: 'text', field: 'tag', value: 'archive', negated: true }
        ])
    })

    it('treats an unknown operator as free text', () => {
        const parsed = parseSearch('https://example.com/a:b')
        expect(parsed.conditions).toEqual([
            { type: 'text', field: 'any', value: 'https://example.com/a:b', negated: false }
        ])
    })

    it('ignores blank input', () => {
        expect(parseSearch('   ').conditions).toEqual([])
    })
})

describe('noteMatchesSearch', () => {
    it('searches title, tags, and body by default', () => {
        const target = note()
        expect(matches('quiet', target)).toBe(true)
        expect(matches('journal', target)).toBe(true)
        expect(matches('paper', target)).toBe(true)
        expect(matches('missing', target)).toBe(false)
    })

    it('scopes title, body, and tag fields', () => {
        const target = note()
        expect(matches('title:quiet', target)).toBe(true)
        expect(matches('title:paper', target)).toBe(false)
        expect(matches('body:paper', target)).toBe(true)
        expect(matches('body:quiet', target)).toBe(false)
        expect(matches('tag:jour', target)).toBe(true)
        expect(matches('tag:quiet', target)).toBe(false)
    })

    it('honours quoted phrases and negation', () => {
        const target = note()
        expect(matches('"paper and the ink"', target)).toBe(true)
        expect(matches('"ink and the paper"', target)).toBe(false)
        expect(matches('-tag:archive', target)).toBe(true)
        expect(matches('-body:paper', target)).toBe(false)
    })

    it('ANDs every condition', () => {
        const target = note()
        expect(matches('tag:journal body:paper', target)).toBe(true)
        expect(matches('tag:journal title:evening', target)).toBe(false)
    })

    it('matches note state with is:', () => {
        expect(matches('is:favorite', note({ isFavorite: true }))).toBe(true)
        expect(matches('is:favorite', note())).toBe(false)
        expect(matches('is:pinned', note({ isPinned: true }))).toBe(true)
        expect(matches('is:trash', note({ isInTrash: true }))).toBe(true)
        expect(matches('is:untagged', note({ tags: [] }))).toBe(true)
        expect(matches('is:untagged', note())).toBe(false)
    })

    it('matches content shapes with has:', () => {
        const checklist = JSON.stringify([
            {
                type: 'checkListItem',
                props: { checked: false },
                content: [text('Milk')],
                children: []
            }
        ])
        const linked = JSON.stringify([
            {
                type: 'paragraph',
                content: [
                    {
                        type: 'link',
                        href: 'indigo:note/other',
                        content: [text('Other note')]
                    }
                ],
                children: []
            }
        ])

        expect(matches('has:task', note({ body: checklist }))).toBe(true)
        expect(matches('has:task', note())).toBe(false)
        expect(matches('has:tag', note())).toBe(true)
        expect(matches('has:tag', note({ tags: [] }))).toBe(false)
        expect(matches('has:link', note({ body: linked }))).toBe(true)
        expect(matches('has:link', note())).toBe(false)
    })

    it('compares edit dates with before: and after:', () => {
        const target = note({ lastModified: '2026-03-15T10:00:00.000Z' })
        expect(matches('before:2026-04-01', target)).toBe(true)
        expect(matches('before:2026-03-01', target)).toBe(false)
        expect(matches('after:2026-03-01', target)).toBe(true)
        expect(matches('after:2026-04-01', target)).toBe(false)
    })

    it('does not throw on an unreadable date', () => {
        expect(matches('before:not-a-date', note())).toBe(false)
    })

    it('matches everything when the query is empty', () => {
        expect(matches('', note())).toBe(true)
    })
})
