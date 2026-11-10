import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { Network, X } from 'lucide-react'
import { useMemo, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
    buildNoteGraph,
    type NoteGraph,
    type NoteGraphEdge,
    type NoteGraphNode
} from '../../../../shared/util/noteGraph'
import { useWorkspace } from '../../state/workspace'

type NoteGraphDialogProps = {
    open: boolean
    focusNoteId: string
    onClose: () => void
}

type Scope = 'local' | 'all'
type Point = { x: number; y: number }

const WIDTH = 820
const HEIGHT = 560
const PADDING = 58

function hashString(value: string): number {
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

function seededRandom(seed: number): () => number {
    let state = seed
    return () => {
        state |= 0
        state = (state + 0x6d2b79f5) | 0
        let value = Math.imul(state ^ (state >>> 15), 1 | state)
        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
}

function layoutLocal(graph: NoteGraph, focusNoteId: string): Map<string, Point> {
    const positions = new Map<string, Point>()
    const focus = graph.nodes.find((node) => node.id === focusNoteId)
    if (!focus) return positions

    const center = { x: WIDTH / 2, y: HEIGHT / 2 }
    positions.set(focus.id, center)

    const neighbours = graph.nodes.filter((node) => node.id !== focus.id)
    const count = neighbours.length
    if (count === 0) return positions

    const radiusX = Math.min(WIDTH / 2 - PADDING - 26, 150 + count * 7)
    const radiusY = Math.min(HEIGHT / 2 - PADDING - 26, 118 + count * 5)

    neighbours.forEach((node, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / count
        positions.set(node.id, {
            x: center.x + Math.cos(angle) * radiusX,
            y: center.y + Math.sin(angle) * radiusY
        })
    })

    return positions
}

function layoutAll(graph: NoteGraph): Map<string, Point> {
    const count = graph.nodes.length
    if (count === 0) return new Map()
    if (count === 1) return new Map([[graph.nodes[0].id, { x: WIDTH / 2, y: HEIGHT / 2 }]])

    const points = graph.nodes.map((node, index) => {
        const random = seededRandom(hashString(node.id))
        const angle = (index / count) * Math.PI * 2 + random() * 0.5
        const radius = Math.min(WIDTH, HEIGHT) * (0.24 + random() * 0.14)
        return {
            id: node.id,
            x: WIDTH / 2 + Math.cos(angle) * radius,
            y: HEIGHT / 2 + Math.sin(angle) * radius
        }
    })

    const indexOf = new Map(points.map((point, index) => [point.id, index]))
    const ideal = Math.sqrt((WIDTH * HEIGHT) / count) * 0.62
    const iterations = count > 120 ? 110 : 190

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const displacement = points.map(() => ({ x: 0, y: 0 }))

        for (let first = 0; first < count; first += 1) {
            for (let second = first + 1; second < count; second += 1) {
                let dx = points[first].x - points[second].x
                let dy = points[first].y - points[second].y
                let distance = Math.hypot(dx, dy)
                if (distance < 0.01) {
                    dx = 0.01
                    dy = 0.01
                    distance = 0.014
                }

                const force = (ideal * ideal) / distance
                const fx = (dx / distance) * force
                const fy = (dy / distance) * force
                displacement[first].x += fx
                displacement[first].y += fy
                displacement[second].x -= fx
                displacement[second].y -= fy
            }
        }

        for (const edge of graph.edges) {
            const source = indexOf.get(edge.source)
            const target = indexOf.get(edge.target)
            if (source === undefined || target === undefined) continue

            let dx = points[target].x - points[source].x
            let dy = points[target].y - points[source].y
            let distance = Math.hypot(dx, dy)
            if (distance < 0.01) {
                dx = 0.01
                dy = 0.01
                distance = 0.014
            }

            const force = ((distance * distance) / ideal) * 0.55
            const fx = (dx / distance) * force
            const fy = (dy / distance) * force
            displacement[source].x += fx
            displacement[source].y += fy
            displacement[target].x -= fx
            displacement[target].y -= fy
        }

        for (let index = 0; index < count; index += 1) {
            displacement[index].x += (WIDTH / 2 - points[index].x) * 0.012
            displacement[index].y += (HEIGHT / 2 - points[index].y) * 0.012
        }

        const cooling = 10 * (1 - iteration / iterations) + 1
        for (let index = 0; index < count; index += 1) {
            const distance = Math.hypot(displacement[index].x, displacement[index].y)
            if (distance < 0.0001) continue
            const step = Math.min(distance, cooling)
            points[index].x += (displacement[index].x / distance) * step
            points[index].y += (displacement[index].y / distance) * step
        }
    }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const point of points) {
        minX = Math.min(minX, point.x)
        maxX = Math.max(maxX, point.x)
        minY = Math.min(minY, point.y)
        maxY = Math.max(maxY, point.y)
    }

    const spanX = Math.max(1, maxX - minX)
    const spanY = Math.max(1, maxY - minY)
    const scale = Math.min((WIDTH - PADDING * 2) / spanX, (HEIGHT - PADDING * 2) / spanY, 1.4)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    return new Map(
        points.map((point) => [
            point.id,
            {
                x: WIDTH / 2 + (point.x - centerX) * scale,
                y: HEIGHT / 2 + (point.y - centerY) * scale
            }
        ])
    )
}

type CombinedEdge = {
    source: string
    target: string
    forward: boolean
    backward: boolean
}

/** One entry per pair, so a two-way link is drawn once rather than twice. */
function combineEdges(edges: NoteGraphEdge[]): CombinedEdge[] {
    const pairs = new Map<string, CombinedEdge>()

    for (const edge of edges) {
        if (edge.source === edge.target) continue
        const first = edge.source < edge.target ? edge.source : edge.target
        const second = edge.source < edge.target ? edge.target : edge.source
        const key = `${first}\u0000${second}`

        let pair = pairs.get(key)
        if (!pair) {
            pair = { source: first, target: second, forward: false, backward: false }
            pairs.set(key, pair)
        }

        if (edge.source === first) pair.forward = true
        else pair.backward = true
    }

    return Array.from(pairs.values())
}

function nodeRadius(node: NoteGraphNode, focusNoteId: string): number {
    const base = 4 + Math.min(7, Math.sqrt(node.degree) * 2)
    return node.id === focusNoteId ? base + 2.5 : base
}

function shortTitle(value: string, limit = 24): string {
    if (value.length <= limit) return value
    return `${value.slice(0, limit - 1)}…`
}

type LabelRect = { left: number; right: number; top: number; bottom: number }

/**
 * The box the label text occupies. Edges are clipped against it so a line
 * never runs behind a note's title. The width is estimated from the rendered
 * character count; a small overestimate is safer than a line touching a glyph.
 */
function labelRect(node: NoteGraphNode, position: Point, focusNoteId: string): LabelRect {
    const radius = nodeRadius(node, focusNoteId)
    const focus = node.id === focusNoteId
    const fontSize = focus ? 11.5 : 10.5
    const width = shortTitle(node.title).length * fontSize * (focus ? 0.62 : 0.58) + 8
    const baseline = position.y + radius + 13

    return {
        left: position.x - width / 2,
        right: position.x + width / 2,
        top: baseline - fontSize * 0.9,
        bottom: baseline + fontSize * 0.3
    }
}

/** Where a segment enters and leaves a rectangle, as fractions of its length. */
function segmentRectInterval(
    from: Point,
    to: Point,
    rect: LabelRect
): { enter: number; exit: number } | null {
    const dx = to.x - from.x
    const dy = to.y - from.y
    let enter = 0
    let exit = 1

    const slabs: Array<[number, number, number, number]> = [
        [from.x, dx, rect.left, rect.right],
        [from.y, dy, rect.top, rect.bottom]
    ]

    for (const [origin, delta, min, max] of slabs) {
        if (Math.abs(delta) < 1e-6) {
            if (origin < min || origin > max) return null
            continue
        }

        let t1 = (min - origin) / delta
        let t2 = (max - origin) / delta
        if (t1 > t2) [t1, t2] = [t2, t1]

        enter = Math.max(enter, t1)
        exit = Math.min(exit, t2)
        if (enter > exit) return null
    }

    return { enter, exit }
}

function pointOnSegment(from: Point, to: Point, t: number): Point {
    return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t
    }
}

export default function NoteGraphDialog({
    open,
    focusNoteId,
    onClose
}: NoteGraphDialogProps): JSX.Element {
    const { notes, openNote } = useWorkspace()
    const [scope, setScope] = useState<Scope>('local')
    const [hoverId, setHoverId] = useState<string | null>(null)

    const close = (): void => {
        setScope('local')
        setHoverId(null)
        onClose()
    }

    const graph = useMemo(
        () => buildNoteGraph(notes, { focusId: focusNoteId, scope, limit: 160 }),
        [focusNoteId, notes, scope]
    )

    const positions = useMemo(
        () => (scope === 'local' ? layoutLocal(graph, focusNoteId) : layoutAll(graph)),
        [focusNoteId, graph, scope]
    )

    const edges = useMemo(() => combineEdges(graph.edges), [graph.edges])

    const neighbourIds = useMemo(() => {
        if (!hoverId) return null
        const ids = new Set<string>([hoverId])
        for (const edge of graph.edges) {
            if (edge.source === hoverId) ids.add(edge.target)
            if (edge.target === hoverId) ids.add(edge.source)
        }
        return ids
    }, [graph.edges, hoverId])

    const openNode = (id: string): void => {
        if (id === focusNoteId) {
            close()
            return
        }
        close()
        void openNote(id)
    }

    const handleNodeKeyDown = (event: ReactKeyboardEvent<SVGGElement>, id: string): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        openNode(id)
    }

    const edgeClass = (edge: NoteGraphEdge): string => {
        if (scope === 'all') return 'graph-edge--neutral'
        if (edge.source === focusNoteId) return 'graph-edge--out'
        if (edge.target === focusNoteId) return 'graph-edge--in'
        return 'graph-edge--neutral'
    }

    const markerFor = (edge: NoteGraphEdge): string => {
        if (scope === 'all') return 'url(#graph-arrow)'
        if (edge.source === focusNoteId) return 'url(#graph-arrow-strong)'
        if (edge.target === focusNoteId) return 'url(#graph-arrow-faint)'
        return 'url(#graph-arrow)'
    }

    const nodeClass = (node: NoteGraphNode): string => {
        if (node.id === focusNoteId) return 'graph-node--focus'
        if (scope === 'all') return 'graph-node--note'
        const outgoing = node.outgoing.includes(focusNoteId)
        const incoming = node.incoming.includes(focusNoteId)
        if (outgoing && incoming) return 'graph-node--mutual'
        if (outgoing) return 'graph-node--out'
        if (incoming) return 'graph-node--in'
        return 'graph-node--note'
    }

    const labelVisible = (node: NoteGraphNode): boolean => {
        if (node.id === focusNoteId) return true
        if (scope === 'local') return true
        if (graph.nodes.length <= 60) return true
        return node.id === hoverId || node.degree >= 3
    }

    const connectionCount = Math.max(0, graph.nodes.length - 1)
    const subtitle =
        scope === 'local'
            ? `${connectionCount} ${connectionCount === 1 ? 'connection' : 'connections'}`
            : `${graph.nodes.length} ${graph.nodes.length === 1 ? 'note' : 'notes'} · ${
                  graph.edges.length
              } ${graph.edges.length === 1 ? 'link' : 'links'}${
                  graph.truncated ? ' · showing recent notes' : ''
              }`

    return (
        <Dialog open={open} onClose={close} className="dialog graph-dialog">
            <DialogBackdrop transition className="dialog-backdrop" />
            <div className="graph-viewport">
                <DialogPanel transition className="graph-panel">
                    <header className="graph-head">
                        <div className="graph-heading">
                            <span className="graph-heading-mark" aria-hidden="true">
                                <Network size={16} />
                            </span>
                            <div>
                                <DialogTitle className="graph-title">Note graph</DialogTitle>
                                <p className="graph-subtitle">{subtitle}</p>
                            </div>
                        </div>

                        <div className="graph-head-actions">
                            <div className="graph-scope" role="group" aria-label="Graph scope">
                                <button
                                    type="button"
                                    className="graph-scope-option"
                                    data-active={scope === 'local' ? 'true' : 'false'}
                                    aria-pressed={scope === 'local'}
                                    onClick={() => {
                                        setScope('local')
                                        setHoverId(null)
                                    }}
                                >
                                    This note
                                </button>
                                <button
                                    type="button"
                                    className="graph-scope-option"
                                    data-active={scope === 'all' ? 'true' : 'false'}
                                    aria-pressed={scope === 'all'}
                                    onClick={() => {
                                        setScope('all')
                                        setHoverId(null)
                                    }}
                                >
                                    All notes
                                </button>
                            </div>
                            <button
                                type="button"
                                className="icon-button"
                                aria-label="Close graph"
                                title="Close graph"
                                onClick={close}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </header>

                    <div className="graph-canvas">
                        {graph.nodes.length === 0 ? (
                            <p className="graph-empty">This note is no longer in the library.</p>
                        ) : (
                            <svg
                                className="graph-svg"
                                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                                role="img"
                                aria-label="Notes and the links between them"
                            >
                                <defs>
                                    <marker
                                        id="graph-arrow"
                                        viewBox="0 0 8 8"
                                        refX="7"
                                        refY="4"
                                        markerWidth="6"
                                        markerHeight="6"
                                        orient="auto-start-reverse"
                                    >
                                        <path d="M0,0 L8,4 L0,8 z" fill="var(--muted)" />
                                    </marker>
                                    <marker
                                        id="graph-arrow-strong"
                                        viewBox="0 0 8 8"
                                        refX="7"
                                        refY="4"
                                        markerWidth="6"
                                        markerHeight="6"
                                        orient="auto-start-reverse"
                                    >
                                        <path d="M0,0 L8,4 L0,8 z" fill="var(--ink-soft)" />
                                    </marker>
                                    <marker
                                        id="graph-arrow-faint"
                                        viewBox="0 0 8 8"
                                        refX="7"
                                        refY="4"
                                        markerWidth="6"
                                        markerHeight="6"
                                        orient="auto-start-reverse"
                                    >
                                        <path d="M0,0 L8,4 L0,8 z" fill="var(--faint)" />
                                    </marker>
                                </defs>

                                {edges.map((pair) => {
                                    const start = positions.get(pair.source)
                                    const end = positions.get(pair.target)
                                    if (!start || !end) return null

                                    const startNode = graph.nodes.find(
                                        (node) => node.id === pair.source
                                    )
                                    const endNode = graph.nodes.find(
                                        (node) => node.id === pair.target
                                    )
                                    if (!startNode || !endNode) return null

                                    const dim =
                                        neighbourIds !== null &&
                                        !neighbourIds.has(pair.source) &&
                                        !neighbourIds.has(pair.target)

                                    const lines: Array<{
                                        key: string
                                        source: string
                                        target: string
                                        both: boolean
                                    }> = []

                                    if (pair.forward && pair.backward) {
                                        // One centred line carries an arrowhead at
                                        // each end, so a mutual link reads as a
                                        // single connection rather than two lines
                                        // fighting for the same space.
                                        lines.push({
                                            key: 'mutual',
                                            source: pair.source,
                                            target: pair.target,
                                            both: true
                                        })
                                    } else if (pair.forward) {
                                        lines.push({
                                            key: 'forward',
                                            source: pair.source,
                                            target: pair.target,
                                            both: false
                                        })
                                    } else {
                                        lines.push({
                                            key: 'backward',
                                            source: pair.target,
                                            target: pair.source,
                                            both: false
                                        })
                                    }

                                    return lines.map((line) => {
                                        const from = positions.get(line.source)
                                        const to = positions.get(line.target)
                                        if (!from || !to) return null

                                        const lineDx = to.x - from.x
                                        const lineDy = to.y - from.y
                                        const lineDistance = Math.hypot(lineDx, lineDy) || 1
                                        const lineUx = lineDx / lineDistance
                                        const lineUy = lineDy / lineDistance
                                        const fromNode = graph.nodes.find(
                                            (node) => node.id === line.source
                                        )
                                        const toNode = graph.nodes.find(
                                            (node) => node.id === line.target
                                        )
                                        if (!fromNode || !toNode) return null

                                        const fromRadius = nodeRadius(fromNode, focusNoteId) + 2
                                        const toRadius = nodeRadius(toNode, focusNoteId) + 2
                                        const edge = {
                                            source: line.source,
                                            target: line.target
                                        }

                                        const baseStart = {
                                            x: from.x + lineUx * fromRadius,
                                            y: from.y + lineUy * fromRadius
                                        }
                                        const baseEnd = {
                                            x: to.x - lineUx * toRadius,
                                            y: to.y - lineUy * toRadius
                                        }

                                        // Clip the line against both titles so it starts
                                        // and ends at the label edge instead of running
                                        // behind the text.
                                        let startT = 0
                                        let endT = 1
                                        const fromLabel = labelVisible(fromNode)
                                            ? labelRect(fromNode, from, focusNoteId)
                                            : null
                                        const toLabel = labelVisible(toNode)
                                            ? labelRect(toNode, to, focusNoteId)
                                            : null
                                        const fromSpan = fromLabel
                                            ? segmentRectInterval(baseStart, baseEnd, fromLabel)
                                            : null
                                        const toSpan = toLabel
                                            ? segmentRectInterval(baseStart, baseEnd, toLabel)
                                            : null

                                        if (fromSpan) startT = Math.max(startT, fromSpan.exit)
                                        if (toSpan) endT = Math.min(endT, toSpan.enter)

                                        const lineLength =
                                            Math.hypot(
                                                baseEnd.x - baseStart.x,
                                                baseEnd.y - baseStart.y
                                            ) || 1
                                        const gapT = 3 / lineLength
                                        if (startT > 0) startT = Math.min(1, startT + gapT)
                                        if (endT < 1) endT = Math.max(0, endT - gapT)
                                        if (endT - startT < 0.01) return null

                                        const startPoint = pointOnSegment(
                                            baseStart,
                                            baseEnd,
                                            startT
                                        )
                                        const endPoint = pointOnSegment(baseStart, baseEnd, endT)

                                        return (
                                            <line
                                                key={`${pair.source}-${pair.target}-${line.key}`}
                                                className={`graph-edge ${edgeClass(edge)}`}
                                                data-dim={dim ? 'true' : 'false'}
                                                x1={startPoint.x}
                                                y1={startPoint.y}
                                                x2={endPoint.x}
                                                y2={endPoint.y}
                                                markerStart={
                                                    line.both ? markerFor(edge) : undefined
                                                }
                                                markerEnd={markerFor(edge)}
                                            />
                                        )
                                    })
                                })}

                                {graph.nodes.map((node) => {
                                    const position = positions.get(node.id)
                                    if (!position) return null
                                    const radius = nodeRadius(node, focusNoteId)
                                    const dim = neighbourIds !== null && !neighbourIds.has(node.id)

                                    return (
                                        <g
                                            key={node.id}
                                            className={`graph-node ${nodeClass(node)}`}
                                            data-dim={dim ? 'true' : 'false'}
                                            transform={`translate(${position.x}, ${position.y})`}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`Open ${node.title}`}
                                            onClick={() => openNode(node.id)}
                                            onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
                                            onMouseEnter={() => setHoverId(node.id)}
                                            onMouseLeave={() => setHoverId(null)}
                                            onFocus={() => setHoverId(node.id)}
                                            onBlur={() => setHoverId(null)}
                                        >
                                            <title>{node.title}</title>
                                            <circle r={radius} />
                                            {labelVisible(node) && (
                                                <text y={radius + 13}>
                                                    {shortTitle(node.title)}
                                                </text>
                                            )}
                                        </g>
                                    )
                                })}

                                {graph.edges.length === 0 && (
                                    <text
                                        className="graph-empty-text"
                                        x={WIDTH / 2}
                                        y={HEIGHT / 2 + 76}
                                        textAnchor="middle"
                                    ></text>
                                )}
                            </svg>
                        )}
                    </div>

                    <footer className="graph-foot">
                        {scope === 'local' ? (
                            <div className="graph-legend">
                                <span>
                                    <i
                                        className="graph-legend-dot graph-legend-dot--out"
                                        aria-hidden="true"
                                    />
                                    Links to
                                </span>
                                <span>
                                    <i
                                        className="graph-legend-dot graph-legend-dot--in"
                                        aria-hidden="true"
                                    />
                                    Linked from
                                </span>
                                <span>
                                    <i
                                        className="graph-legend-dot graph-legend-dot--mutual"
                                        aria-hidden="true"
                                    />
                                    Both ways
                                </span>
                            </div>
                        ) : (
                            <p className="graph-foot-note">Every link in the library.</p>
                        )}
                        <p className="graph-foot-hint">Click a note to open it</p>
                    </footer>
                </DialogPanel>
            </div>
        </Dialog>
    )
}
