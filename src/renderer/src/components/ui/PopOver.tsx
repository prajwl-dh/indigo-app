import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import React from 'react'
import { twMerge } from 'tailwind-merge'

type Anchor =
    | 'bottom'
    | 'bottom start'
    | 'bottom end'
    | 'top'
    | 'top start'
    | 'top end'
    | 'left'
    | 'left start'
    | 'left end'
    | 'right'
    | 'right start'
    | 'right end'

interface PopoverComponentProps {
    trigger: React.ReactNode
    children: React.ReactNode
    anchor?: Anchor
    className?: string
    buttonClassName?: string
    panelClassName?: string
    title?: string
}

export default function PopoverComponent({
    trigger,
    children,
    anchor = 'bottom',
    className,
    buttonClassName,
    panelClassName,
    title
}: PopoverComponentProps): React.JSX.Element {
    return (
        <Popover className={twMerge('relative inline-block', className)}>
            <PopoverButton
                title={title}
                as="div"
                className={twMerge('cursor-pointer', buttonClassName)}
            >
                {trigger}
            </PopoverButton>

            <PopoverPanel
                anchor={anchor}
                className={twMerge(
                    'z-50 rounded-lg bg-white dark:bg-[#1c1c1e]',
                    'data-closed:opacity-0 data-closed:scale-95 transition',
                    panelClassName
                )}
            >
                {children}
            </PopoverPanel>
        </Popover>
    )
}
