/**
 * Starting points for a new note. A template is just a title and a saved
 * BlockNote document; no code runs in the editor for them, so what you see
 * is exactly what lands on disk.
 */

export type NoteTemplateInput = {
    title: string
    body: string
}

export type NoteTemplate = {
    id: string
    label: string
    description: string
    build: () => NoteTemplateInput
}

type UnknownRecord = Record<string, unknown>

type BlockInput = {
    type: string
    props?: UnknownRecord
    content?: unknown
    children?: BlockInput[]
}

function heading(text: string, level: number): BlockInput {
    return {
        type: 'heading',
        props: { level },
        content: [{ type: 'text', text, styles: {} }],
        children: []
    }
}

function checkItem(checked: boolean, text = ''): BlockInput {
    return {
        type: 'checkListItem',
        props: { checked },
        content: text ? [{ type: 'text', text, styles: {} }] : [],
        children: []
    }
}

function dayLabel(now: Date): string {
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    }).format(now)
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
    {
        id: 'journal',
        label: 'Journal page',
        description: 'Today’s date with prompts to write into',
        build: () => ({
            title: `Journal — ${dayLabel(new Date())}`,
            body: JSON.stringify([
                heading(dayLabel(new Date()), 3),
                heading('What happened', 4),
                heading('What I noticed', 4),
                heading('What I want tomorrow to be', 4)
            ])
        })
    },
    {
        id: 'meeting',
        label: 'Meeting notes',
        description: 'Attendees, agenda, decisions and action items',
        build: () => ({
            title: `Meeting notes — ${dayLabel(new Date())}`,
            body: JSON.stringify([
                heading('Meeting notes', 3),
                heading('Attendees', 4),
                heading('Agenda', 4),
                heading('Decisions', 4),
                heading('Action items', 4)
            ])
        })
    },
    {
        id: 'todo',
        label: 'To-do list',
        description: 'A page of checkboxes to fill in',
        build: () => ({
            title: `To do — ${dayLabel(new Date())}`,
            body: JSON.stringify([checkItem(false), checkItem(false), checkItem(false)])
        })
    }
]

export function findTemplate(id: string | undefined | null): NoteTemplate | null {
    if (!id) return null
    return NOTE_TEMPLATES.find((template) => template.id === id) ?? null
}
