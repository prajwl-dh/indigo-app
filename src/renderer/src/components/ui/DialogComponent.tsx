import {
    Description,
    Dialog,
    DialogPanel,
    DialogTitle,
    Transition,
    TransitionChild
} from '@headlessui/react'
import { Fragment, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export interface DialogComponentProps {
    open: boolean
    onClose: () => void
    title?: string
    description?: string
    children: ReactNode
    className?: string
    icon?: React.ReactNode
    titleClassName?: string
    descriptionClassName?: string
}

export function DialogComponent({
    open,
    onClose,
    title,
    description,
    children,
    className = '',
    titleClassName = '',
    descriptionClassName = '',
    icon
}: DialogComponentProps): React.JSX.Element {
    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                {/* Backdrop */}
                <TransitionChild
                    as={Fragment}
                    enter="ease-in duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div
                        className="fixed inset-0 bg-transparent backdrop-blur-sm"
                        aria-hidden="true"
                    />
                </TransitionChild>

                {/* Dialog container */}
                <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
                    <TransitionChild
                        as={Fragment}
                        enter="ease-in duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <DialogPanel
                            className={twMerge(
                                'max-w-lg space-y-4 border bg-white p-6 rounded-lg',
                                className
                            )}
                        >
                            {icon}

                            {title && (
                                <DialogTitle
                                    className={twMerge('text-lg font-bold', titleClassName)}
                                >
                                    {title}
                                </DialogTitle>
                            )}

                            {description && (
                                <Description
                                    className={twMerge(
                                        'text-sm text-gray-600',
                                        descriptionClassName
                                    )}
                                >
                                    {description}
                                </Description>
                            )}

                            {children}
                        </DialogPanel>
                    </TransitionChild>
                </div>
            </Dialog>
        </Transition>
    )
}
