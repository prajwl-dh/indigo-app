export type NoteColorDefinition = {
    id: string
    label: string
    light: string
    dark: string
}

/**
 * A note can carry one colour to identify it in the library. The values are
 * chosen to hold their own against the paper surface in either theme, and the
 * library bar and editor flag both use the same value.
 */
export const noteColors = [
    { id: 'indigo', label: 'Indigo', light: '#4f46e5', dark: '#a5b4fc' },
    { id: 'cobalt', label: 'Cobalt', light: '#1d4ed8', dark: '#93c5fd' },
    { id: 'teal', label: 'Teal', light: '#0f766e', dark: '#5eead4' },
    { id: 'moss', label: 'Moss', light: '#3f6212', dark: '#bef264' },
    { id: 'amber', label: 'Amber', light: '#9a5b05', dark: '#fcd34d' },
    { id: 'ember', label: 'Ember', light: '#b4400c', dark: '#fdba74' },
    { id: 'rose', label: 'Rose', light: '#be123c', dark: '#fda4af' },
    { id: 'plum', label: 'Plum', light: '#7e22ce', dark: '#d8b4fe' },
    { id: 'slate', label: 'Slate', light: '#475569', dark: '#cbd5e1' },
    { id: 'ink', label: 'Ink', light: '#292524', dark: '#d6d3d1' }
] as const satisfies readonly NoteColorDefinition[]

export type NoteColor = (typeof noteColors)[number]['id']

export const noteColorIds: NoteColor[] = noteColors.map((color) => color.id)

export function isNoteColor(value: unknown): value is NoteColor {
    return typeof value === 'string' && noteColorIds.includes(value as NoteColor)
}

export function getNoteColor(id: NoteColor): NoteColorDefinition {
    return noteColors.find((color) => color.id === id) ?? noteColors[0]
}
