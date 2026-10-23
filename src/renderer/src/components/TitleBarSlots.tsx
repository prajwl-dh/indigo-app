import { useMemo, useState, type JSX, type ReactNode } from 'react'
import { TitleBarSlotsContext } from './titleBarSlotContext'

/**
 * The title bar owns the note actions, but the open note owns their state.
 * This registry lets the editor portal its controls into the bar without
 * lifting save and colour state into the shell.
 */
export function TitleBarSlotsProvider({ children }: { children: ReactNode }): JSX.Element {
    const [actions, setActions] = useState<HTMLElement | null>(null)
    const [back, setBack] = useState<HTMLElement | null>(null)

    const value = useMemo(() => ({ actions, back, setActions, setBack }), [actions, back])

    return <TitleBarSlotsContext.Provider value={value}>{children}</TitleBarSlotsContext.Provider>
}
