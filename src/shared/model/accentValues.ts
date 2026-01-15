import { Accent } from './accent'

interface AccentConfig {
    label: string
    hex: string
    text: string
    bg: string
    bgHover: string
    bgSubtle: string
    hover: string
    ring: string
    selection: string
    border: string
}

export const accentValue: Record<Accent, AccentConfig> = {
    indigo: {
        label: 'Indigo',
        hex: '#4f46e5',
        text: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-600 dark:bg-indigo-500',
        bgHover: 'hover:bg-indigo-700 dark:hover:bg-indigo-600',
        bgSubtle: 'bg-indigo-500/10 dark:bg-indigo-500/10',
        hover: 'hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300',
        ring: 'ring-indigo-200 dark:ring-indigo-500/30',
        selection: 'selection:bg-indigo-100 dark:selection:bg-indigo-500/30',
        border: 'border-indigo-100 dark:border-indigo-500/20'
    },
    rose: {
        label: 'Rose',
        hex: '#e11d48',
        text: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-600 dark:bg-rose-500',
        bgHover: 'hover:bg-rose-700 dark:hover:bg-rose-600',
        bgSubtle: 'bg-rose-500/10 dark:bg-rose-500/10',
        hover: 'hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10 dark:hover:text-rose-300',
        ring: 'ring-rose-200 dark:ring-rose-500/30',
        selection: 'selection:bg-rose-100 dark:selection:bg-rose-500/30',
        border: 'border-rose-100 dark:border-rose-500/20'
    },
    orange: {
        label: 'Orange',
        hex: '#9a3412',
        text: 'text-orange-800 dark:text-orange-400',
        bg: 'bg-orange-800 dark:bg-orange-500',
        bgHover: 'hover:bg-orange-900 dark:hover:bg-orange-600',
        bgSubtle: 'bg-orange-500/10 dark:bg-orange-500/10',
        hover: 'hover:bg-orange-50 hover:text-orange-900 dark:hover:bg-orange-500/10 dark:hover:text-orange-300',
        ring: 'ring-orange-200 dark:ring-orange-500/30',
        selection: 'selection:bg-orange-100 dark:selection:bg-orange-500/30',
        border: 'border-orange-100 dark:border-orange-500/20'
    },
    teal: {
        label: 'Teal',
        hex: '#115e59',
        text: 'text-teal-800 dark:text-teal-400',
        bg: 'bg-teal-800 dark:bg-teal-500',
        bgHover: 'hover:bg-teal-900 dark:hover:bg-teal-600',
        bgSubtle: 'bg-teal-500/10 dark:bg-teal-500/10',
        hover: 'hover:bg-teal-50 hover:text-teal-900 dark:hover:bg-teal-500/10 dark:hover:text-teal-300',
        ring: 'ring-teal-200 dark:ring-teal-500/30',
        selection: 'selection:bg-teal-100 dark:selection:bg-teal-500/30',
        border: 'border-teal-100 dark:border-teal-500/20'
    },
    blue: {
        label: 'Blue',
        hex: '#2563eb',
        text: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-600 dark:bg-blue-500',
        bgHover: 'hover:bg-blue-700 dark:hover:bg-blue-600',
        bgSubtle: 'bg-blue-500/10 dark:bg-blue-500/10',
        hover: 'hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-500/10 dark:hover:text-blue-300',
        ring: 'ring-blue-200 dark:ring-blue-500/30',
        selection: 'selection:bg-blue-100 dark:selection:bg-blue-500/30',
        border: 'border-blue-100 dark:border-blue-500/20'
    },
    violet: {
        label: 'Violet',
        hex: '#7c3aed',
        text: 'text-violet-600 dark:text-violet-400',
        bg: 'bg-violet-600 dark:bg-violet-500',
        bgHover: 'hover:bg-violet-700 dark:hover:bg-violet-600',
        bgSubtle: 'bg-violet-500/10 dark:bg-violet-500/10',
        hover: 'hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-500/10 dark:hover:text-violet-300',
        ring: 'ring-violet-200 dark:ring-violet-500/30',
        selection: 'selection:bg-violet-100 dark:selection:bg-violet-500/30',
        border: 'border-violet-100 dark:border-violet-500/20'
    }
}
