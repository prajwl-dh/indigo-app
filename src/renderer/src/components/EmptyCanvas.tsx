import { FileText, Hash, Plus, Star, Trash2 } from 'lucide-react'
import { useMemo, type JSX } from 'react'
import { sameTag } from '../../../shared/util/tags'
import BrandMark from './BrandMark'
import { countLabel } from '../lib/format'
import { useWorkspace } from '../state/workspace'

export default function EmptyCanvas(): JSX.Element {
    const { notes, tags, view, activeTag, search, setView, createNote } = useWorkspace()

    const inScope = useMemo(() => {
        return notes.filter((note) => {
            if (view === 'trash') return note.isInTrash
            if (note.isInTrash) return false
            if (view === 'favorites' && !note.isFavorite) return false
            if (activeTag && !note.tags.some((tag) => sameTag(tag, activeTag))) return false
            return true
        }).length
    }, [activeTag, notes, view])

    const copy = (() => {
        if (search.trim()) {
            return 'Your search is filtering the library on the left. Choose a result to open it, or clear the search to browse again.'
        }
        if (activeTag) {
            return `Choose a note tagged ${activeTag} from the library, or start a new page. It will join this tag automatically.`
        }
        if (view === 'favorites') {
            return 'Choose a starred note from the library to keep reading, or star more notes to gather them here.'
        }
        if (view === 'trash') {
            return 'Choose a note from the trash to read it. Restore anything you want to keep, or empty the trash when you are sure.'
        }
        return 'Choose a note from the library, or begin a new page. Every keystroke is written to this computer as you work.'
    })()

    const kicker = activeTag
        ? `Tag · ${activeTag}`
        : view === 'favorites'
          ? 'Favorites'
          : view === 'trash'
            ? 'Trash'
            : 'All notes'

    return (
        <section className="empty-canvas" aria-label="No note open">
            <div className="empty-inner">
                <div className="empty-mark" aria-hidden="true">
                    <BrandMark size={30} />
                </div>

                <p className="empty-kicker">{kicker}</p>
                <h2 className="empty-title">A quiet place for your thinking.</h2>
                <p className="empty-copy">{copy}</p>

                <div className="empty-actions">
                    {view !== 'trash' && (
                        <button
                            type="button"
                            className="button button--primary"
                            onClick={() => void createNote()}
                        >
                            <Plus size={15} />
                            New note
                        </button>
                    )}
                    {view !== 'all' || activeTag ? (
                        <button
                            type="button"
                            className="button button--secondary"
                            onClick={() => void setView('all')}
                        >
                            <FileText size={15} />
                            View all notes
                        </button>
                    ) : null}
                </div>

                <dl className="empty-stats">
                    <div className="empty-stat">
                        {view === 'favorites' ? (
                            <Star size={13} aria-hidden="true" />
                        ) : view === 'trash' ? (
                            <Trash2 size={13} aria-hidden="true" />
                        ) : (
                            <FileText size={13} aria-hidden="true" />
                        )}
                        <dt>{activeTag ? 'Tagged' : 'In view'}</dt>
                        <dd>{countLabel(inScope, 'note')}</dd>
                    </div>
                    <div className="empty-stat">
                        <Hash size={13} aria-hidden="true" />
                        <dt>Tags</dt>
                        <dd>{countLabel(tags.length, 'tag')}</dd>
                    </div>
                    <div className="empty-stat">
                        <span className="empty-stat-dot" aria-hidden="true" />
                        <dt>Storage</dt>
                        <dd>On this computer</dd>
                    </div>
                </dl>
            </div>
        </section>
    )
}
