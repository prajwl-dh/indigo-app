import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { Maximize, Minus, Network, Plus, X } from 'lucide-react'
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type JSX,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent
} from 'react'
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
type Transform = { x: number; y: number; k: number }

/**
 * The graph is laid out in a virtual space that tracks the size of the panel,
 * so node and label sizes stay in CSS pixels at every screen size instead of
 * being squeezed by a fixed viewBox. The base size is the reference layout the
 * viewport scale is derived from.
 */
const BASE_WIDTH = 820
const BASE_HEIGHT = 560
const PADDING = 58
const VIEW_SCALE_MAX = 1.6
const ZOOM_MIN = 0.35
const ZOOM_MAX = 4
const ZOOM_STEP = 1.25

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

function layoutLocal(
    graph: NoteGraph,
    focusNoteId: string,
    width: number,
    height: number
): Map<string, Point> {
    const positions = new Map<string, Point>()
    const focus = graph.nodes.find((node) => node.id === focusNoteId)
    if (!focus) return positions

    const center = { x: width / 2, y: height / 2 }
    positions.set(focus.id, center)

    const neighbours = graph.nodes.filter((node) => node.id !== focus.id)
    const count = neighbours.length
    if (count === 0) return positions

    const radiusX = Math.min(width / 2 - PADDING - 26, width * 0.3 + count * 6)
    const radiusY = Math.min(height / 2 - PADDING - 26, height * 0.32 + count * 5)

    neighbours.forEach((node, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / count
        positions.set(node.id, {
            x: center.x + Math.cos(angle) * radiusX,
            y: center.y + Math.sin(angle) * radiusY
        })
    })

    return positions
}

function layoutAll(graph: NoteGraph, width: number, height: number): Map<string, Point> {
    const count = graph.nodes.length
    if (count === 0) return new Map()
    if (count === 1) return new Map([[graph.nodes[0].id, { x: width / 2, y: height / 2 }]])

    const points = graph.nodes.map((node, index) => {
        const random = seededRandom(hashString(node.id))
        const angle = (index / count) * Math.PI * 2 + random() * 0.5
        const radius = Math.min(width, height) * (0.24 + random() * 0.14)
        return {
            id: node.id,
            x: width / 2 + Math.cos(angle) * radius,
            y: height / 2 + Math.sin(angle) * radius
        }
    })

    const indexOf = new Map(points.map((point, index) => [point.id, index]))
    const ideal = Math.sqrt((width * height) / count) * 0.62
    const iterations = count > 120 ? 110 : 190
    // Gravity strong enough to keep even unlinked notes inside the frame, so
    // the final fit-to-box pass never crushes linked clusters together.
    const bound = Math.max(1, Math.min(width, height) / 2 - PADDING)
    const gravity = ((count - 1) * (ideal * ideal)) / (bound * bound)

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
            displacement[index].x += (width / 2 - points[index].x) * gravity
            displacement[index].y += (height / 2 - points[index].y) * gravity
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
    const scale = Math.min((width - PADDING * 2) / spanX, (height - PADDING * 2) / spanY, 1.4)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    return new Map(
        points.map((point) => [
            point.id,
            {
                x: width / 2 + (point.x - centerX) * scale,
                y: height / 2 + (point.y - centerY) * scale
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
    const base = 5 + Math.min(8, Math.sqrt(node.degree) * 2.2)
    return node.id === focusNoteId ? base + 3 : base
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
    const fontSize = focus ? 13 : 12
    const width = shortTitle(node.title).length * fontSize * (focus ? 0.62 : 0.58) + 8
    const baseline = position.y + radius + 14

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

type PanState = {
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
}

type NodeDragState = {
    pointerId: number
    id: string
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
}

export default function NoteGraphDialog({
    open,
    focusNoteId,
    onClose
}: NoteGraphDialogProps): JSX.Element {
    const { notes, openNote } = useWorkspace()
    const [scope, setScope] = useState<Scope>('local')
    const [hoverId, setHoverId] = useState<string | null>(null)
    const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 })
    const [movedNodes, setMovedNodes] = useState<Map<string, Point>>(() => new Map())
    const [size, setSize] = useState({ width: 0, height: 0 })

    const svgRef = useRef<SVGSVGElement | null>(null)
    const observerRef = useRef<ResizeObserver | null>(null)
    const transformRef = useRef(transform)
    const panRef = useRef<PanState | null>(null)
    const dragRef = useRef<NodeDragState | null>(null)
    const dragMovedRef = useRef(false)

    useEffect(() => {
        transformRef.current = transform
    }, [transform])

    // Track the panel's real size so the graph is laid out in the space it
    // actually has, keeping nodes and labels at a readable size on any screen.
    // A callback ref re-attaches the observer whenever the dialog mounts the
    // canvas, and disconnects it when the element goes away.
    const attachCanvas = useCallback((element: HTMLDivElement | null): void => {
        observerRef.current?.disconnect()
        observerRef.current = null
        if (!element) return

        const observer = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect
            if (!rect) return
            setSize({
                width: Math.max(1, Math.round(rect.width)),
                height: Math.max(1, Math.round(rect.height))
            })
        })
        observer.observe(element)
        observerRef.current = observer
    }, [])

    const view = useMemo(() => {
        if (size.width === 0 || size.height === 0) {
            return { width: BASE_WIDTH, height: BASE_HEIGHT, scale: 1 }
        }
        // Never render below the reference size, so the graph keeps legible
        // proportions on small screens; scale up modestly on larger ones.
        const scale = Math.min(
            VIEW_SCALE_MAX,
            Math.max(1, Math.min(size.width / BASE_WIDTH, size.height / BASE_HEIGHT))
        )
        return { width: size.width / scale, height: size.height / scale, scale }
    }, [size])

    const applyZoom = useCallback((factor: number, cx: number, cy: number) => {
        setTransform((current) => {
            const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current.k * factor))
            const ratio = k / current.k
            return {
                k,
                x: cx - (cx - current.x) * ratio,
                y: cy - (cy - current.y) * ratio
            }
        })
    }, [])

    const applyZoomRef = useRef(applyZoom)
    useEffect(() => {
        applyZoomRef.current = applyZoom
    }, [applyZoom])

    /**
     * The scale the viewBox is rendered at, read live from the element so
     * pointer maths never works from a stale measurement.
     */
    const currentScale = (): number => {
        const svg = svgRef.current
        if (!svg) return 1
        const rect = svg.getBoundingClientRect()
        const base = svg.viewBox.baseVal.width
        return base > 0 && rect.width > 0 ? rect.width / base : 1
    }

    // Wheel zoom is attached natively so preventDefault works on the trackpad.
    // A callback ref keeps the listener on the svg element whenever the dialog
    // mounts it, and removes it when the element goes away.
    const handleWheel = useCallback((event: WheelEvent): void => {
        event.preventDefault()
        const svg = event.currentTarget as SVGSVGElement
        const rect = svg.getBoundingClientRect()
        const base = svg.viewBox.baseVal.width
        const scale = base > 0 && rect.width > 0 ? rect.width / base : 1
        const cx = (event.clientX - rect.left) / scale
        const cy = (event.clientY - rect.top) / scale
        const factor = Math.exp(-event.deltaY * 0.0016)
        applyZoomRef.current(factor, cx, cy)
    }, [])

    const attachSvg = useCallback(
        (element: SVGSVGElement | null): void => {
            const previous = svgRef.current
            if (previous) previous.removeEventListener('wheel', handleWheel)
            svgRef.current = element
            if (element) element.addEventListener('wheel', handleWheel, { passive: false })
        },
        [handleWheel]
    )

    const close = (): void => {
        setScope('local')
        setHoverId(null)
        setTransform({ x: 0, y: 0, k: 1 })
        setMovedNodes(new Map())
        onClose()
    }

    const changeScope = (next: Scope): void => {
        setScope(next)
        setHoverId(null)
        setTransform({ x: 0, y: 0, k: 1 })
        setMovedNodes(new Map())
    }

    const graph = useMemo(
        () => buildNoteGraph(notes, { focusId: focusNoteId, scope, limit: 160 }),
        [focusNoteId, notes, scope]
    )

    const positions = useMemo(() => {
        const base =
            scope === 'local'
                ? layoutLocal(graph, focusNoteId, view.width, view.height)
                : layoutAll(graph, view.width, view.height)
        if (movedNodes.size === 0) return base

        const merged = new Map(base)
        for (const [id, point] of movedNodes) {
            if (base.has(id)) merged.set(id, point)
        }
        return merged
    }, [focusNoteId, graph, movedNodes, scope, view.height, view.width])

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

    const handleNodeClick = (id: string): void => {
        if (dragMovedRef.current) {
            dragMovedRef.current = false
            return
        }
        openNode(id)
    }

    const handleNodeKeyDown = (event: ReactKeyboardEvent<SVGGElement>, id: string): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        openNode(id)
    }

    const pointFromEvent = (event: { clientX: number; clientY: number }): Point => {
        const rect = svgRef.current?.getBoundingClientRect()
        if (!rect) return { x: 0, y: 0 }
        const scale = currentScale()
        return {
            x: (event.clientX - rect.left) / scale,
            y: (event.clientY - rect.top) / scale
        }
    }

    const startPan = (event: ReactPointerEvent<SVGRectElement>): void => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        panRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: transformRef.current.x,
            originY: transformRef.current.y
        }
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    const startNodeDrag = (event: ReactPointerEvent<SVGGElement>, node: NoteGraphNode): void => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        const position = positions.get(node.id)
        if (!position) return

        event.stopPropagation()
        dragMovedRef.current = false
        dragRef.current = {
            pointerId: event.pointerId,
            id: node.id,
            startX: event.clientX,
            startY: event.clientY,
            originX: position.x,
            originY: position.y,
            moved: false
        }
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    const handleSvgPointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
        const pan = panRef.current
        if (pan && pan.pointerId === event.pointerId) {
            const scale = currentScale()
            setTransform((current) => ({
                ...current,
                x: pan.originX + (event.clientX - pan.startX) / scale,
                y: pan.originY + (event.clientY - pan.startY) / scale
            }))
            return
        }

        const drag = dragRef.current
        if (drag && drag.pointerId === event.pointerId) {
            if (
                !drag.moved &&
                Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3
            ) {
                drag.moved = true
                dragMovedRef.current = true
            }
            if (drag.moved) {
                const scale = currentScale() * transformRef.current.k
                const x = drag.originX + (event.clientX - drag.startX) / scale
                const y = drag.originY + (event.clientY - drag.startY) / scale
                setMovedNodes((current) => new Map(current).set(drag.id, { x, y }))
            }
        }
    }

    const endPointer = (event: ReactPointerEvent<SVGSVGElement>): void => {
        if (panRef.current?.pointerId === event.pointerId) panRef.current = null
        if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    }

    const handleBackgroundDoubleClick = (event: ReactMouseEvent<SVGRectElement>): void => {
        const point = pointFromEvent(event)
        applyZoom(ZOOM_STEP, point.x, point.y)
    }

    const zoomBy = (factor: number): void => {
        applyZoom(factor, view.width / 2, view.height / 2)
    }

    const resetView = (): void => {
        setTransform({ x: 0, y: 0, k: 1 })
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
                                    onClick={() => changeScope('local')}
                                >
                                    This note
                                </button>
                                <button
                                    type="button"
                                    className="graph-scope-option"
                                    data-active={scope === 'all' ? 'true' : 'false'}
                                    aria-pressed={scope === 'all'}
                                    onClick={() => changeScope('all')}
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

                    <div className="graph-canvas" ref={attachCanvas}>
                        {graph.nodes.length === 0 ? (
                            <p className="graph-empty">This note is no longer in the library.</p>
                        ) : (
                            <>
                                <svg
                                    ref={attachSvg}
                                    className="graph-svg"
                                    viewBox={`0 0 ${view.width} ${view.height}`}
                                    role="img"
                                    aria-label="Notes and the links between them"
                                    onPointerMove={handleSvgPointerMove}
                                    onPointerUp={endPointer}
                                    onPointerCancel={endPointer}
                                >
                                    <rect
                                        className="graph-hit"
                                        x={0}
                                        y={0}
                                        width={view.width}
                                        height={view.height}
                                        fill="transparent"
                                        onPointerDown={startPan}
                                        onDoubleClick={handleBackgroundDoubleClick}
                                    />
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

                                    <g
                                        transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}
                                    >
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

                                                const fromRadius =
                                                    nodeRadius(fromNode, focusNoteId) + 2
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
                                                    ? segmentRectInterval(
                                                          baseStart,
                                                          baseEnd,
                                                          fromLabel
                                                      )
                                                    : null
                                                const toSpan = toLabel
                                                    ? segmentRectInterval(
                                                          baseStart,
                                                          baseEnd,
                                                          toLabel
                                                      )
                                                    : null

                                                if (fromSpan)
                                                    startT = Math.max(startT, fromSpan.exit)
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
                                                const endPoint = pointOnSegment(
                                                    baseStart,
                                                    baseEnd,
                                                    endT
                                                )

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
                                            const dim =
                                                neighbourIds !== null && !neighbourIds.has(node.id)

                                            return (
                                                <g
                                                    key={node.id}
                                                    className={`graph-node ${nodeClass(node)}`}
                                                    data-dim={dim ? 'true' : 'false'}
                                                    transform={`translate(${position.x}, ${position.y})`}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label={`Open ${node.title}`}
                                                    onClick={() => handleNodeClick(node.id)}
                                                    onKeyDown={(event) =>
                                                        handleNodeKeyDown(event, node.id)
                                                    }
                                                    onPointerDown={(event) =>
                                                        startNodeDrag(event, node)
                                                    }
                                                    onMouseEnter={() => setHoverId(node.id)}
                                                    onMouseLeave={() => setHoverId(null)}
                                                    onFocus={() => setHoverId(node.id)}
                                                    onBlur={() => setHoverId(null)}
                                                >
                                                    <title>{node.title}</title>
                                                    <circle r={radius} />
                                                    {labelVisible(node) && (
                                                        <text y={radius + 14}>
                                                            {shortTitle(node.title)}
                                                        </text>
                                                    )}
                                                </g>
                                            )
                                        })}

                                        {graph.edges.length === 0 && (
                                            <text
                                                className="graph-empty-text"
                                                x={view.width / 2}
                                                y={view.height / 2 + 76}
                                                textAnchor="middle"
                                            ></text>
                                        )}
                                    </g>
                                </svg>

                                <div className="graph-zoom" role="group" aria-label="Zoom controls">
                                    <button
                                        type="button"
                                        className="icon-button"
                                        aria-label="Zoom out"
                                        title="Zoom out"
                                        onClick={() => zoomBy(1 / ZOOM_STEP)}
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        className="icon-button"
                                        aria-label="Reset view"
                                        title="Reset view"
                                        onClick={resetView}
                                    >
                                        <Maximize size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        className="icon-button"
                                        aria-label="Zoom in"
                                        title="Zoom in"
                                        onClick={() => zoomBy(ZOOM_STEP)}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </>
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
                        <p className="graph-foot-hint">Scroll to zoom · drag to pan</p>
                    </footer>
                </DialogPanel>
            </div>
        </Dialog>
    )
}
