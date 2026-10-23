import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { Check, Plus, X } from 'lucide-react'
import { useMemo, useState, type JSX } from 'react'
import type { Tag } from '../../../../shared/model/note'
import { MAX_TAGS_PER_NOTE, sameTag } from '../../../../shared/util/tags'
import { useToast } from '../../state/toast'

type TagPickerProps = {
    tags: string[]
    allTags: Tag[]
    disabled?: boolean
    onChange: (tags: string[]) => Promise<void>
    onCreateTag: (name: string) => Promise<Tag>
}

export default function TagPicker({
    tags,
    allTags,
    disabled = false,
    onChange,
    onCreateTag
}: TagPickerProps): JSX.Element {
    const { push, pushError } = useToast()
    const [query, setQuery] = useState('')
    const [busy, setBusy] = useState(false)

    const ordered = useMemo(
        () => [...allTags].sort((a, b) => a.name.localeCompare(b.name)),
        [allTags]
    )

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        if (!needle) return ordered
        return ordered.filter((tag) => tag.name.toLowerCase().includes(needle))
    }, [ordered, query])

    const canCreate =
        query.trim().length > 0 && !allTags.some((tag) => sameTag(tag.name, query.trim()))

    const createAndAdd = async (name: string, close: () => void): Promise<void> => {
        if (busy) return
        if (tags.length >= MAX_TAGS_PER_NOTE) {
            push(`A note can hold ${MAX_TAGS_PER_NOTE} tags.`)
            return
        }

        setBusy(true)
        try {
            const tag = await onCreateTag(name)
            await onChange([...tags, tag.name])
            setQuery('')
            close()
        } catch (caught) {
            pushError(caught, 'Could not create that tag.')
        } finally {
            setBusy(false)
        }
    }

    const toggle = async (name: string): Promise<void> => {
        if (busy) return
        const assigned = tags.some((tag) => sameTag(tag, name))

        if (!assigned && tags.length >= MAX_TAGS_PER_NOTE) {
            push(`A note can hold ${MAX_TAGS_PER_NOTE} tags.`)
            return
        }

        setBusy(true)
        try {
            await onChange(assigned ? tags.filter((tag) => !sameTag(tag, name)) : [...tags, name])
        } catch (caught) {
            pushError(caught, 'Could not update the tags on this note.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="tag-row">
            {tags.map((tag) => (
                <span className="tag-chip" key={tag}>
                    <span className="tag-chip-label">{tag}</span>
                    {!disabled && (
                        <button
                            type="button"
                            className="tag-chip-remove"
                            aria-label={`Remove tag ${tag}`}
                            title={`Remove ${tag}`}
                            onClick={() => void toggle(tag)}
                        >
                            <X size={11} />
                        </button>
                    )}
                </span>
            ))}

            {!disabled && (
                <Popover className="tag-picker">
                    <PopoverButton
                        type="button"
                        className="tag-add"
                        disabled={tags.length >= MAX_TAGS_PER_NOTE}
                        title={
                            tags.length >= MAX_TAGS_PER_NOTE
                                ? `A note can hold ${MAX_TAGS_PER_NOTE} tags`
                                : 'Add a tag'
                        }
                    >
                        <Plus size={13} />
                        <span>{tags.length === 0 ? 'Add tag' : 'Tag'}</span>
                    </PopoverButton>
                    <PopoverPanel anchor="bottom start" portal transition className="tag-popover">
                        {({ close }) => (
                            <div className="tag-popover-inner">
                                <input
                                    className="tag-search"
                                    value={query}
                                    placeholder="Find or create a tag"
                                    aria-label="Find or create a tag"
                                    spellCheck={false}
                                    autoFocus
                                    onChange={(event) => setQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault()
                                            if (canCreate) {
                                                void createAndAdd(query.trim(), close)
                                            } else if (filtered[0]) {
                                                void toggle(filtered[0].name)
                                            }
                                        }
                                        if (event.key === 'Escape') {
                                            event.preventDefault()
                                            close()
                                        }
                                    }}
                                />

                                <div className="tag-options" role="listbox" aria-label="Tags">
                                    {filtered.map((tag) => {
                                        const assigned = tags.some((entry) =>
                                            sameTag(entry, tag.name)
                                        )
                                        return (
                                            <button
                                                type="button"
                                                className="tag-option"
                                                key={tag.name}
                                                role="option"
                                                aria-selected={assigned}
                                                onClick={() => void toggle(tag.name)}
                                            >
                                                <span className="tag-option-name">{tag.name}</span>
                                                {assigned && (
                                                    <Check
                                                        className="tag-option-check"
                                                        size={14}
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </button>
                                        )
                                    })}

                                    {canCreate && (
                                        <button
                                            type="button"
                                            className="tag-option tag-option--create"
                                            onClick={() => void createAndAdd(query.trim(), close)}
                                            disabled={busy}
                                        >
                                            <Plus size={13} aria-hidden="true" />
                                            <span>
                                                Create <strong>{query.trim()}</strong>
                                            </span>
                                        </button>
                                    )}

                                    {filtered.length === 0 && !canCreate && (
                                        <p className="tag-empty">No tags match that name.</p>
                                    )}
                                </div>

                                {tags.length >= MAX_TAGS_PER_NOTE && (
                                    <p className="tag-limit">
                                        This note is at its {MAX_TAGS_PER_NOTE} tag limit.
                                    </p>
                                )}
                            </div>
                        )}
                    </PopoverPanel>
                </Popover>
            )}
        </div>
    )
}
