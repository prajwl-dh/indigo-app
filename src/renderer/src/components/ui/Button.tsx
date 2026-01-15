import React, { ButtonHTMLAttributes, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode
    className?: string
}

export default function Button({ children, className, ...props }: ButtonProps): React.JSX.Element {
    return (
        <button
            {...props}
            className={twMerge(
                'rounded-md border ring border-light-border dark:border-dark-border p-2 outline-none',
                className
            )}
        >
            {children}
        </button>
    )
}
