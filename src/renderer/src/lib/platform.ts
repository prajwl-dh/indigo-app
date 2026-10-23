export const platform = window.indigo?.platform ?? 'darwin'
export const isMac = platform === 'darwin'
export const shortcutKey = isMac ? '⌘' : 'Ctrl'
