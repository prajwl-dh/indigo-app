import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react'
import { Ban, Check, Palette } from 'lucide-react'
import type { CSSProperties, JSX } from 'react'
import { getNoteColor, noteColors, type NoteColor } from '../../../../shared/model/noteColor'
import { useAppearance } from '../../state/appearance'

type NoteColorMenuProps = {
    color: NoteColor | null
    onChange: (color: NoteColor | null) => void
}

export default function NoteColorMenu({ color, onChange }: NoteColorMenuProps): JSX.Element {
    const { resolved } = useAppearance()
    const active = color ? getNoteColor(color) : null
    const activeValue = active ? active[resolved] : null

    return (
        <Menu as="div" className="menu-root">
            <MenuButton
                type="button"
                className="icon-button color-button"
                aria-label={active ? `Note colour: ${active.label}` : 'Choose a note colour'}
                title="Note colour"
            >
                <Palette size={16} />
                <span
                    className="color-button-dot"
                    data-empty={color === null ? 'true' : 'false'}
                    style={
                        activeValue ? ({ '--note-color': activeValue } as CSSProperties) : undefined
                    }
                    aria-hidden="true"
                />
            </MenuButton>
            <MenuItems anchor="bottom end" portal transition className="menu-panel color-panel">
                <div className="color-panel-head">
                    <span className="color-panel-title">Note colour</span>
                    <span className="color-panel-value">{active ? active.label : 'None'}</span>
                </div>
                <div className="color-swatches" role="group" aria-label="Note colour">
                    {noteColors.map((entry) => {
                        const selected = color === entry.id
                        return (
                            <MenuItem
                                as="button"
                                key={entry.id}
                                type="button"
                                className="color-option"
                                data-active={selected ? 'true' : 'false'}
                                aria-label={entry.label}
                                aria-pressed={selected}
                                title={entry.label}
                                onClick={() => onChange(entry.id)}
                            >
                                <span
                                    className="color-option-swatch"
                                    style={{ backgroundColor: entry[resolved] }}
                                >
                                    {selected && <Check size={12} strokeWidth={3} />}
                                </span>
                            </MenuItem>
                        )
                    })}
                </div>
                <MenuSeparator className="menu-separator" />
                <MenuItem
                    as="button"
                    type="button"
                    className="menu-item"
                    onClick={() => onChange(null)}
                >
                    <Ban size={14} />
                    No colour
                    {color === null && <Check size={13} className="color-none-check" />}
                </MenuItem>
            </MenuItems>
        </Menu>
    )
}
