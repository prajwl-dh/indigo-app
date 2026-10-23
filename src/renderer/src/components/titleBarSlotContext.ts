import { createContext, useContext } from 'react'

export type TitleBarSlotRegistry = {
    /** Where the open note's actions (save state, colour, star, menu) render. */
    actions: HTMLElement | null
    /** Where the compact back button renders. */
    back: HTMLElement | null
    setActions: (element: HTMLElement | null) => void
    setBack: (element: HTMLElement | null) => void
}

export const TitleBarSlotsContext = createContext<TitleBarSlotRegistry | null>(null)

export function useTitleBarSlots(): TitleBarSlotRegistry {
    const value = useContext(TitleBarSlotsContext)
    if (!value) throw new Error('useTitleBarSlots must be used inside TitleBarSlotsProvider')
    return value
}
