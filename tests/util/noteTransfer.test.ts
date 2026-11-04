import { describe, expect, it } from 'vitest'
import type { Note } from '../../src/shared/model/note'
import {
    noteFileContents,
    noteToHTML,
    noteToHTMLFragment,
    noteToMarkdown,
    noteToText,
    transferExtension,
    transferLabel
} from '../../src/shared/util/noteTransfer'

const text = (value: string): { type: 'text'; text: string; styles: object } => ({
    type: 'text',
    text: value,
    styles: {}
})

const body = JSON.stringify([
    { type: 'heading', props: { level: 3 }, content: [text('A & B')], children: [] },
    {
        type: 'paragraph',
        content: [
            text('Some <prose> '),
            {
                type: 'link',
                href: 'https://example.com',
                content: [text('link')]
            }
        ],
        children: []
    },
    { type: 'bulletListItem', content: [text('One')], children: [] },
    {
        type: 'checkListItem',
        props: { checked: true },
        content: [text('Done')],
        children: []
    },
    { type: 'quote', content: [text('Quoted')], children: [] },
    { type: 'codeBlock', props: { language: 'ts' }, content: 'const a = 1 < 2', children: [] }
])

function note(overrides: Partial<Note> = {}): Note {
    return {
        id: 'note-1',
        title: 'A & B',
        body,
        lastModified: '2026-03-15T10:00:00.000Z',
        createdAt: '2026-01-01T10:00:00.000Z',
        isFavorite: false,
        isInTrash: false,
        tags: [],
        color: null,
        ...overrides
    }
}

describe('noteToText', () => {
    it('puts the title above the plain body', () => {
        const text = noteToText(note())
        expect(text.startsWith('A & B\n\n')).toBe(true)
        expect(text).toContain('Some <prose> link')
        expect(text).toContain('One')
        expect(text).toContain('const a = 1 < 2')
    })

    it('omits an empty title', () => {
        expect(noteToText(note({ title: '   ' })).startsWith('A & B')).toBe(true)
    })
})

describe('noteToMarkdown', () => {
    it('writes a title and the block structure', () => {
        const markdown = noteToMarkdown(note())
        expect(markdown).toContain('# A & B')
        expect(markdown).toContain('### A & B')
        expect(markdown).toContain('- One')
        expect(markdown).toContain('- [x] Done')
        expect(markdown).toContain('> Quoted')
        expect(markdown).toContain('```ts\nconst a = 1 < 2\n```')
    })

    it('returns just the body when there is no title', () => {
        expect(noteToMarkdown(note({ title: '' })).startsWith('### A & B')).toBe(true)
    })
})

describe('noteToHTML', () => {
    it('escapes text and writes semantic blocks', () => {
        const html = noteToHTML(note())
        expect(html.startsWith('<!doctype html>')).toBe(true)
        expect(html).toContain('<title>A &amp; B</title>')
        expect(html).toContain('<h3>A &amp; B</h3>')
        expect(html).toContain('Some &lt;prose&gt;')
        expect(html).toContain('<a href="https://example.com">link</a>')
        expect(html).toContain('<li>One</li>')
        expect(html).toContain('<input type="checkbox" disabled checked> Done')
        expect(html).toContain('<blockquote><p>Quoted</p></blockquote>')
        expect(html).toContain('<pre><code>const a = 1 &lt; 2</code></pre>')
    })

    it('falls back to a readable empty page', () => {
        const html = noteToHTML(note({ title: '', body: '' }))
        expect(html).toContain('<h1>Untitled note</h1>')
        expect(html).toContain('(Still empty.)')
    })

    it('builds a fragment for the clipboard without a document wrapper', () => {
        const fragment = noteToHTMLFragment(note())
        expect(fragment.startsWith('<h1>A &amp; B</h1>')).toBe(true)
        expect(fragment).not.toContain('<!doctype html>')
    })
})

describe('file helpers', () => {
    it('labels each transfer format', () => {
        expect(transferLabel('text')).toBe('Text')
        expect(transferLabel('markdown')).toBe('Markdown')
        expect(transferLabel('html')).toBe('HTML')
        expect(transferExtension('text')).toBe('.txt')
        expect(transferExtension('markdown')).toBe('.md')
        expect(transferExtension('html')).toBe('.html')
    })

    it('writes empty notes with a gentle placeholder', () => {
        const empty = note({ title: '', body: '' })
        expect(noteFileContents(empty, 'text')).toBe('(Still empty.)\n')
        expect(noteFileContents(empty, 'markdown')).toBe('*(Still empty.)*\n')
        expect(noteFileContents(empty, 'html')).toContain('(Still empty.)')
    })

    it('ends text and Markdown files with a newline', () => {
        expect(noteFileContents(note(), 'text').endsWith('\n')).toBe(true)
        expect(noteFileContents(note(), 'markdown').endsWith('\n')).toBe(true)
    })
})
