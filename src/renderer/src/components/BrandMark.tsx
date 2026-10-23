import { useId, type JSX } from 'react'

type BrandMarkProps = {
    size?: number
    className?: string
}

const DROP =
    'M12 2C13.18 4.94 15.28 7.46 17.29 10.07C18.64 11.88 19.23 13.35 19.23 14.77A7.23 7.23 0 1 1 4.77 14.77C4.77 13.35 5.36 11.88 6.71 10.07C8.72 7.46 10.82 4.94 12 2Z'

/**
 * Indigo's mark is a drop of ink with the lines of a page cut out of it — the
 * same silhouette as the app icon, drawn in whatever ink the surface uses.
 */
export default function BrandMark({ size = 18, className }: BrandMarkProps): JSX.Element {
    const maskId = `brandmark-${useId().replace(/:/g, '')}`

    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse" x="3" y="1" width="18" height="22">
                    <path d={DROP} fill="#ffffff" />
                    <path
                        d="M8.55 12.5H15.61M8.55 15.02H14.02M8.55 17.55H11.66"
                        fill="none"
                        stroke="#000000"
                        strokeWidth="1.05"
                        strokeLinecap="round"
                    />
                </mask>
            </defs>
            <path d={DROP} fill="currentColor" mask={`url(#${maskId})`} />
        </svg>
    )
}
