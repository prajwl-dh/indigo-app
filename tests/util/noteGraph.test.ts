import { describe, expect, it } from 'vitest'
import type { Note } from '../../src/shared/model/note'
import { noteHref } from '../../src/shared/util/noteLinks'
import { buildNoteGraph } from '../../src/shared/util/noteGraph'

function note(id: string, title: string, links: string[] = [], isInTrash = false): Note {
    const content = links.length
        ? [
              {
                  type: 'paragraph',
                  content: links.map((target) => ({
                      type: 'link',
                      href: noteHref(target),
                      content: [{ type: 'text', text: target, styles: {} }]
                  })),
                  children: []
              }
          ]
        : [{ type: 'paragraph', content: [], children: [] }]

    return {
        id,
        title,
        body: JSON.stringify(content),
        lastModified: new Date(2026, 0, 1).toISOString(),
        createdAt: new Date(2026, 0, 1).toISOString(),
        isFavorite: false,
        isInTrash,
        tags: [],
        color: null
    }
}

describe('buildNoteGraph', () => {
    it('builds directed incoming and outgoing links', () => {
        const notes = [note('a', 'Alpha', ['b']), note('b', 'Beta', ['c']), note('c', 'Gamma')]

        const graph = buildNoteGraph(notes, { focusId: 'b', scope: 'all' })

        expect(graph.nodes.map((node) => node.id)).toEqual(['b', 'a', 'c'])
        expect(graph.nodes.find((node) => node.id === 'a')?.outgoing).toEqual(['b'])
        expect(graph.nodes.find((node) => node.id === 'b')?.incoming).toEqual(['a'])
        expect(graph.nodes.find((node) => node.id === 'b')?.outgoing).toEqual(['c'])
        expect(graph.nodes.find((node) => node.id === 'b')?.degree).toBe(2)
        expect(graph.edges).toEqual([
            { source: 'a', target: 'b' },
            { source: 'b', target: 'c' }
        ])
    })

    it('keeps a local graph to the focus note and its neighbours', () => {
        const notes = [
            note('focus', 'Focus', ['out']),
            note('out', 'Outgoing', ['far']),
            note('in', 'Incoming', ['focus']),
            note('far', 'Far away'),
            note('trash', 'Trashed', ['focus'], true)
        ]

        const graph = buildNoteGraph(notes, { focusId: 'focus', scope: 'local' })

        expect(graph.nodes.map((node) => node.id).sort()).toEqual(['focus', 'in', 'out'])
        expect(graph.edges).toEqual(
            expect.arrayContaining([
                { source: 'focus', target: 'out' },
                { source: 'in', target: 'focus' }
            ])
        )
        expect(graph.nodes.some((node) => node.id === 'far')).toBe(false)
        expect(graph.nodes.some((node) => node.id === 'trash')).toBe(false)
    })

    it('ignores self links and links to missing or trashed notes', () => {
        const notes = [
            note('a', 'Alpha', ['a', 'missing', 'trash']),
            note('trash', 'Trashed', ['a'], true)
        ]

        const graph = buildNoteGraph(notes, { focusId: 'a', scope: 'all' })

        expect(graph.nodes.map((node) => node.id)).toEqual(['a'])
        expect(graph.edges).toEqual([])
    })

    it('caps a large library but keeps the focus note', () => {
        const notes = Array.from({ length: 8 }, (_, index) =>
            note(`n${index}`, `Note ${index}`, index === 7 ? [] : [`n${index + 1}`])
        )

        const graph = buildNoteGraph(notes, { focusId: 'n7', scope: 'all', limit: 3 })

        expect(graph.truncated).toBe(true)
        expect(graph.nodes).toHaveLength(3)
        expect(graph.nodes.some((node) => node.id === 'n7')).toBe(true)
    })

    it('returns an empty graph when the focus note is missing', () => {
        expect(buildNoteGraph([note('a', 'Alpha')], { focusId: 'gone' })).toEqual({
            nodes: [],
            edges: [],
            truncated: false
        })
    })
})
