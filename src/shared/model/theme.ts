export const themes = ['light', 'dark', 'system'] as const

export type Theme = (typeof themes)[number]

export type ResolvedTheme = 'light' | 'dark'

export function isTheme(value: unknown): value is Theme {
    return typeof value === 'string' && themes.includes(value as Theme)
}
