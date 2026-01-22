import { ButtonHTMLAttributes, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import Button from './Button'

interface FolderChipType extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode
    className: string
}

export default function FolderChip({
    children,
    className,
    ...props
}: FolderChipType): React.JSX.Element {
    return (
        <Button
            className={twMerge(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-light-secondaryText dark:text-dark-primaryText cursor-default bg-white dark:bg-[#1c1c1e]',
                className
            )}
            {...props}
        >
            {children}
        </Button>
    )
}
