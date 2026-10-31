import type { NotesView } from '../../../shared/model/note'

export function viewName(view: NotesView): string {
    if (view === 'favorites') return 'Favorites'
    if (view === 'tasks') return 'Tasks'
    if (view === 'trash') return 'Trash'
    return 'All notes'
}
