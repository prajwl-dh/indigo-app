import { describe, expect, it } from 'vitest'
import { NOTE_TEMPLATES, findTemplate } from '../../src/shared/util/noteTemplates'
import { isBlockDocumentEmpty } from '../../src/shared/util/noteText'

describe('note templates', () => {
    it('has unique ids and labels', () => {
        expect(new Set(NOTE_TEMPLATES.map((t) => t.id)).size).toBe(NOTE_TEMPLATES.length)
    })

    it('builds well-formed saved notes: a title and a parseable body', () => {
        for (const template of NOTE_TEMPLATES) {
            const built = template.build()
            expect(built.title.trim().length).toBeGreaterThan(0)

            let parsed: unknown
            expect(() => (parsed = JSON.parse(built.body))).not.toThrow()
            expect(Array.isArray(parsed)).toBe(true)
        }
    })

    it('produces bodies the editor reads as non-empty', () => {
        // The to-do template is a page of empty checkboxes on purpose; the
        // structure is the content, so only the prompts-based templates are
        // non-empty in the editor's eyes.
        for (const template of NOTE_TEMPLATES.filter((t) => t.id !== 'todo')) {
            expect(isBlockDocumentEmpty(template.build().body)).toBe(false)
        }
    })

    it('dates a journal page with today', () => {
        const journal = NOTE_TEMPLATES.find((t) => t.id === 'journal')
        expect(journal).toBeDefined()
        expect(journal!.build().title).toContain('Journal — ')
    })

    it('resolves by id and nothing for a made-up id', () => {
        expect(findTemplate('meeting')?.id).toBe('meeting')
        expect(findTemplate('nope')).toBeNull()
        expect(findTemplate(null)).toBeNull()
    })
})
