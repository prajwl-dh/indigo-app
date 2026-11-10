import type { Note } from '../model/note'
import { extractNoteLinkIds } from './noteLinks'

/**
 * A note graph is derived from the saved documents on every read. Links are
 * ordinary note links, so the graph can never drift away from the editor's
 * content.
 */
export type NoteGraphNode = {
    id: string
    title: string
    /** Notes that point at this one. */
    incoming: string[]
    /** Notes this one points at. */
    outgoing: string[]
    /** Unique notes on either side of a link. */
    degree: number
}

export type NoteGraphEdge = {
    source: string
    target: string
}

export type NoteGraph = {
    nodes: NoteGraphNode[]
    edges: NoteGraphEdge[]
    /** True when the workspace is larger than the requested node limit. */
    truncated: boolean
}

type NoteGraphOptions = {
    /** The note at the centre of a local graph. */
    focusId?: string
    /** "local" is the focus note and its direct neighbours; "all" is the library. */
    scope?: 'local' | 'all'
    /** A ceiling for very large libraries. */
    limit?: number
}

function titleOf(note: Note): string {
    return note.title.trim() || 'Untitled note'
}

function modifiedAt(note: Note): number {
    const time = new Date(note.lastModified).getTime()
    return Number.isFinite(time) ? time : 0
}

/**
 * Builds the directed graph for the editor's graph view.
 *
 * Local scope keeps the focus note, every note it links to, every note that
 * links to it, and the links between those neighbours. All scope keeps the
 * whole active library (newest notes first when a limit applies).
 */
export function buildNoteGraph(notes: Note[], options: NoteGraphOptions = {}): NoteGraph {
    const scope = options.scope ?? 'local'
    const limit = Math.max(1, options.limit ?? 160)
    const active = notes.filter((note) => !note.isInTrash)
    const byId = new Map(active.map((note) => [note.id, note]))

    const outgoing = new Map<string, string[]>()
    for (const note of active) {
        const targets = Array.from(
            new Set(
                extractNoteLinkIds(note.body).filter(
                    (targetId) => targetId !== note.id && byId.has(targetId)
                )
            )
        )
        outgoing.set(note.id, targets)
    }

    const incoming = new Map<string, string[]>()
    for (const [source, targets] of outgoing) {
        for (const target of targets) {
            const list = incoming.get(target)
            if (list) {
                list.push(source)
            } else {
                incoming.set(target, [source])
            }
        }
    }

    const allEdges: NoteGraphEdge[] = []
    for (const [source, targets] of outgoing) {
        for (const target of targets) allEdges.push({ source, target })
    }

    const makeNode = (note: Note): NoteGraphNode => {
        const outgoingIds = outgoing.get(note.id) ?? []
        const incomingIds = incoming.get(note.id) ?? []
        return {
            id: note.id,
            title: titleOf(note),
            incoming: incomingIds,
            outgoing: outgoingIds,
            degree: new Set([...incomingIds, ...outgoingIds]).size
        }
    }

    if (scope === 'local') {
        const focus = options.focusId ? byId.get(options.focusId) : undefined
        if (!focus) return { nodes: [], edges: [], truncated: false }

        const ids = new Set<string>([focus.id])
        for (const id of outgoing.get(focus.id) ?? []) ids.add(id)
        for (const id of incoming.get(focus.id) ?? []) ids.add(id)

        const nodes = Array.from(ids, (id) => byId.get(id))
            .filter((note): note is Note => note !== undefined)
            .map(makeNode)
            .sort((a, b) => {
                if (a.id === focus.id) return -1
                if (b.id === focus.id) return 1
                return a.title.localeCompare(b.title)
            })

        const edges = allEdges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
        return { nodes, edges, truncated: false }
    }

    let selected = active
    let truncated = false

    if (active.length > limit) {
        truncated = true
        const keep = new Set(
            [...active]
                .sort((a, b) => modifiedAt(b) - modifiedAt(a))
                .slice(0, limit)
                .map((note) => note.id)
        )
        if (options.focusId && byId.has(options.focusId) && !keep.has(options.focusId)) {
            // The focus note is always visible, even when it is older than the
            // rest of the ceiling. It replaces the least recent kept note so
            // the limit stays a limit.
            if (keep.size >= limit) {
                const last = Array.from(keep).at(-1)
                if (last) keep.delete(last)
            }
            keep.add(options.focusId)
        }
        selected = active.filter((note) => keep.has(note.id))
    }

    const ids = new Set(selected.map((note) => note.id))
    const nodes = selected.map(makeNode).sort((a, b) => {
        if (a.id === options.focusId) return -1
        if (b.id === options.focusId) return 1
        return a.title.localeCompare(b.title)
    })
    const edges = allEdges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))

    return { nodes, edges, truncated }
}
