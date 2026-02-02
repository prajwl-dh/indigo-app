import { Accent } from './accent'

interface AccentConfig {
    label: string
    hex: string
    text: string
    bg: string
    bgHover: string
    bgSubtle: string
    hover: string
    selection: string
    border: string
    active: string
}

export const accentValue: Record<Accent, AccentConfig> = {
    indigo: {
        label: 'Indigo',
        hex: '#4f39f6',
        text: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-600 dark:bg-indigo-500',
        bgHover: 'hover:bg-indigo-700 dark:hover:bg-indigo-600',
        bgSubtle: 'bg-indigo-500/10 dark:bg-indigo-500/10',
        hover: 'hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400',
        selection: 'selection:bg-indigo-100 dark:selection:bg-indigo-500/30',
        border: 'border-indigo-300 dark:border-indigo-500/50',
        active: 'hover:border-indigo-300 hover:dark:border-indigo-500/50'
    },
    blue: {
        label: 'Blue',
        hex: '#165dfc',
        text: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-600 dark:bg-blue-500',
        bgHover: 'hover:bg-blue-700 dark:hover:bg-blue-600',
        bgSubtle: 'bg-blue-500/10 dark:bg-blue-500/10',
        hover: 'hover:bg-blue-500/10 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400',
        selection: 'selection:bg-blue-100 dark:selection:bg-blue-500/30',
        border: 'border-blue-300 dark:border-blue-500/50',
        active: 'hover:border-blue-300 hover:dark:border-blue-500/50'
    },
    cyan: {
        label: 'Cyan',
        hex: '#0092b9',
        text: 'text-cyan-600 dark:text-cyan-400',
        bg: 'bg-cyan-600 dark:bg-cyan-500',
        bgHover: 'hover:bg-cyan-700 dark:hover:bg-cyan-600',
        bgSubtle: 'bg-cyan-500/10 dark:bg-cyan-500/10',
        hover: 'hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-400',
        selection: 'selection:bg-cyan-100 dark:selection:bg-cyan-500/30',
        border: 'border-cyan-300 dark:border-cyan-500/50',
        active: 'hover:border-cyan-300 hover:dark:border-cyan-500/50'
    },
    orange: {
        label: 'Orange',
        hex: '#f54900',
        text: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-600 dark:bg-orange-500',
        bgHover: 'hover:bg-orange-700 dark:hover:bg-orange-600',
        bgSubtle: 'bg-orange-500/10 dark:bg-orange-500/10',
        hover: 'hover:bg-orange-500/10 hover:text-orange-600 dark:hover:bg-orange-500/10 dark:hover:text-orange-400',
        selection: 'selection:bg-orange-100 dark:selection:bg-orange-500/30',
        border: 'border-orange-300 dark:border-orange-500/50',
        active: 'hover:border-orange-300 hover:dark:border-orange-500/50'
    },
    green: {
        label: 'Green',
        hex: '#00a63d',
        text: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-600 dark:bg-green-500',
        bgHover: 'hover:bg-green-700 dark:hover:bg-green-600',
        bgSubtle: 'bg-green-500/10 dark:bg-green-500/10',
        hover: 'hover:bg-green-500/10 hover:text-green-600 dark:hover:bg-green-500/10 dark:hover:text-green-400',
        selection: 'selection:bg-green-100 dark:selection:bg-green-500/30',
        border: 'border-green-300 dark:border-green-500/50',
        active: 'hover:border-green-300 hover:dark:border-green-500/50'
    },
    purple: {
        label: 'Purple',
        hex: '#990ffa',
        text: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-600 dark:bg-purple-500',
        bgHover: 'hover:bg-purple-700 dark:hover:bg-purple-600',
        bgSubtle: 'bg-purple-500/10 dark:bg-purple-500/10',
        hover: 'hover:bg-purple-500/10 hover:text-purple-600 dark:hover:bg-purple-500/10 dark:hover:text-purple-400',
        selection: 'selection:bg-purple-100 dark:selection:bg-purple-500/30',
        border: 'border-purple-300 dark:border-purple-500/50',
        active: 'hover:border-purple-300 hover:dark:border-purple-500/50'
    }
}
