export type NoteColorDefinition = {
    id: string
    label: string
    light: string
    dark: string
}

/**
 * A note can carry one color to identify it in the library. The values are
 * chosen to hold their own against the paper surface in either theme, and the
 * library bar and editor flag both use the same value.
 *
 * The order runs as a spectrum (warm to cool, then neutrals) so the swatch
 * grid reads like a palette rather than an arbitrary list.
 */
export const noteColors = [
    { id: 'rose', label: 'Rose', light: '#be123c', dark: '#fda4af' },
    { id: 'pink', label: 'Pink', light: '#db2777', dark: '#f9a8d4' },
    { id: 'ember', label: 'Ember', light: '#b4400c', dark: '#fdba74' },
    { id: 'cocoa', label: 'Cocoa', light: '#6b4423', dark: '#d9b99b' },
    { id: 'gold', label: 'Gold', light: '#8a6a00', dark: '#fde047' },
    { id: 'amber', label: 'Amber', light: '#9a5b05', dark: '#fcd34d' },
    { id: 'moss', label: 'Moss', light: '#3f6212', dark: '#bef264' },
    { id: 'emerald', label: 'Emerald', light: '#047857', dark: '#6ee7b7' },
    { id: 'teal', label: 'Teal', light: '#0f766e', dark: '#5eead4' },
    { id: 'aqua', label: 'Aqua', light: '#0e7490', dark: '#67e8f9' },
    { id: 'sky', label: 'Sky', light: '#0369a1', dark: '#7dd3fc' },
    { id: 'cobalt', label: 'Cobalt', light: '#1d4ed8', dark: '#93c5fd' },
    { id: 'indigo', label: 'Indigo', light: '#4f46e5', dark: '#a5b4fc' },
    { id: 'violet', label: 'Violet', light: '#5b21b6', dark: '#c4b5fd' },
    { id: 'plum', label: 'Plum', light: '#7e22ce', dark: '#d8b4fe' },
    { id: 'slate', label: 'Slate', light: '#475569', dark: '#cbd5e1' },
    { id: 'stone', label: 'Stone', light: '#78716c', dark: '#e7e5e4' },
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
