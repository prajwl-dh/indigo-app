import type { JSX } from 'react'
import { formatBytes } from '../lib/format'

type UpdateMeterProps = {
    receivedBytes: number
    totalBytes: number | null
    percent: number | null
    label: string
}

export default function UpdateMeter({
    receivedBytes,
    totalBytes,
    percent,
    label
}: UpdateMeterProps): JSX.Element {
    const value = percent ?? (totalBytes ? Math.min(100, (receivedBytes / totalBytes) * 100) : null)
    const size =
        totalBytes && totalBytes > 0
            ? `${formatBytes(receivedBytes)} of ${formatBytes(totalBytes)}`
            : formatBytes(receivedBytes)

    return (
        <div className="update-meter">
            <div
                className="update-meter-track"
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value === null ? undefined : Math.round(value)}
                aria-valuetext={value === null ? size : `${Math.round(value)} percent, ${size}`}
            >
                <span
                    className="update-meter-fill"
                    style={{ width: `${value === null ? 0 : Math.max(0, Math.min(100, value))}%` }}
                />
            </div>
            <p className="update-meter-meta">
                <span>{label}</span>
                <span>
                    {size}
                    {value !== null ? ` · ${Math.round(value)}%` : ''}
                </span>
            </p>
        </div>
    )
}
