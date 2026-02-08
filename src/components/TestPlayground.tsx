import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
    createMarkdownParser,
    createJsonHandler,
    StreamParser,
    ExperimentalMarkdownStreamParser,
    ExperimentalJSONParser,
    type ParsedNode,
    type PatternHandler,
    type HandlerExtension
} from '../lib'
import { MarkdownStreamRenderer } from './MarkdownRenderer'

interface TestCase {
    id: string
    name: string
    input: string
    description?: string
}

type MarkdownEngine = 'stable' | 'experimental-v2'
type JsonEngine = 'stable' | 'experimental-v2'

const EXAMPLE_MARKDOWN = `# Hello World

This is a **bold** statement and _italic_ text.

## Features

- Streaming parser
- Real-time rendering
- Pattern handlers

1. First item
2. Second item
3. Third item

> This is a blockquote

Check out this \`inline code\` and [link](https://example.com).

---

### Nested formatting

This is **bold with _nested italic_ inside** it.

# Here's another table at the end

| Column 1 | Column 2 | Column 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
`

export function TestPlayground() {
    const [input, setInput] = useState(EXAMPLE_MARKDOWN)
    const [streamedContent, setStreamedContent] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [streamSpeed, setStreamSpeed] = useState(50) // ticks per second
    const [burstSize, setBurstSize] = useState(1)
    const [burstMode, setBurstMode] = useState<'chars' | 'words'>('chars')
    const [parsedAST, setParsedAST] = useState<unknown>(null)
    const [savedTestCases, setSavedTestCases] = useState<TestCase[]>([])
    const [testCaseName, setTestCaseName] = useState('')
    const [selectedExample, setSelectedExample] = useState('markdown')
    const [markdownEngine, setMarkdownEngine] = useState<MarkdownEngine>('stable')
    const [jsonEngine, setJsonEngine] = useState<JsonEngine>('stable')

    const streamIntervalRef = useRef<number | null>(null)
    const charIndexRef = useRef(0)
    const inputRef = useRef(input)

    useEffect(() => {
        inputRef.current = input
    }, [input])

    const exampleConfigs = useMemo(() => {
        const imageHandler: PatternHandler = {
            name: 'image',
            elementName: 'img',
            allowedNestings: [],
            start: (buffer) => {
                if (buffer.endsWith('![')) return 'potential'
                if (buffer.match(/!\[[^\s]$/)) return 'commit'
                return 'no'
            },
            prefixLength: () => 3,
            commit: (buffer) => buffer[buffer.length - 1] ?? '',
            feed: (char, node) => {
                if (!node.attributes[0]) {
                    node.attributes[0] = { phase: 'alt', buffer: '' }
                }
                const state = node.attributes[0]
                if (state.phase === 'alt') {
                    if (char === ']') {
                        state.phase = 'between'
                    } else {
                        node.children.push(char)
                    }
                    return false
                }
                if (state.phase === 'between') {
                    if (char === '(') state.phase = 'src'
                    return false
                }
                if (state.phase === 'src') {
                    if (char === ')') {
                        node.attributes[0] = { src: state.buffer }
                        return true
                    }
                    state.buffer += char
                }
                return false
            }
        }

        const imageExtension: HandlerExtension = {
            name: 'images',
            handlers: [imageHandler],
            placement: { before: 'a' }
        }

        const jsonHandler = createJsonHandler()

        const diagramHandler: PatternHandler = {
            name: 'diagram',
            elementName: 'diagram',
            allowedNestings: [],
            start: (buffer) => {
                if (buffer.endsWith('graph{')) return 'commit'
                if (buffer.endsWith('graph{'.slice(0, buffer.length))) return 'potential'
                return 'no'
            },
            prefixLength: () => 6,
            commit: () => '',
            feed: (char, node) => {
                if (!node.attributes[0]) {
                    node.attributes[0] = {
                        phase: 'node',
                        buffer: '',
                        currentEdge: null
                    }
                }
                const state = node.attributes[0] as {
                    phase: 'node' | 'arrow' | 'target'
                    buffer: string
                    currentEdge: { from: string; to?: string; label?: string } | null
                }

                const flushNode = () => {
                    const name = state.buffer.trim()
                    if (!name) return
                    node.children.push({ element: 'node', children: [name], attributes: [] })
                    state.buffer = ''
                }

                const flushEdge = () => {
                    if (!state.currentEdge?.from || !state.currentEdge?.to) return
                    node.children.push({
                        element: 'edge',
                        children: [state.currentEdge.from, state.currentEdge.to],
                        attributes: state.currentEdge.label ? [{ label: state.currentEdge.label }] : []
                    })
                    state.currentEdge = null
                }

                if (char === '}') {
                    flushNode()
                    flushEdge()
                    return true
                }

                if (state.phase === 'node') {
                    if (char === '-') {
                        const from = state.buffer.trim()
                        if (from) {
                            state.currentEdge = { from }
                            state.buffer = ''
                            state.phase = 'arrow'
                        }
                        return false
                    }
                    if (char === ';') {
                        flushNode()
                        return false
                    }
                    state.buffer += char
                    return false
                }

                if (state.phase === 'arrow') {
                    if (char === '>') {
                        state.phase = 'target'
                        return false
                    }
                    if (char === '[') {
                        state.currentEdge = state.currentEdge ?? { from: '' }
                        state.currentEdge.label = ''
                        return false
                    }
                    if (char === ']') {
                        return false
                    }
                    if (state.currentEdge?.label !== undefined) {
                        state.currentEdge.label += char
                        return false
                    }
                    return false
                }

                if (state.phase === 'target') {
                    if (char === ';') {
                        state.currentEdge = state.currentEdge ?? { from: '' }
                        state.currentEdge.to = state.buffer.trim()
                        state.buffer = ''
                        flushEdge()
                        state.phase = 'node'
                        return false
                    }
                    state.buffer += char
                    return false
                }

                return false
            }
        }

        return [
            {
                id: 'markdown',
                name: markdownEngine === 'stable' ? 'Markdown (stable + images)' : 'Markdown (experimental v2)',
                description:
                    markdownEngine === 'stable'
                        ? 'Stable markdown parser with image extension enabled.'
                        : 'Experimental v2 markdown parser (state-machine handlers).',
                input: EXAMPLE_MARKDOWN,
                renderer: 'markdown' as const,
                createParser: () =>
                    markdownEngine === 'stable'
                        ? createMarkdownParser([imageExtension])
                        : new ExperimentalMarkdownStreamParser()
            },
            {
                id: 'json',
                name: jsonEngine === 'stable' ? 'Streaming JSON (stable)' : 'Streaming JSON (experimental v2)',
                description:
                    jsonEngine === 'stable'
                        ? 'Incremental JSON collector with nested objects/arrays.'
                        : 'Experimental v2 JSON parser (FSM-based handler).',
                input: '{\"user\":{\"id\":1,\"tags\":[\"alpha\",\"beta\"],\"ok\":true}}',
                renderer: 'json' as const,
                createParser: () =>
                    jsonEngine === 'stable'
                        ? new StreamParser([jsonHandler])
                        : new ExperimentalJSONParser()
            },
            {
                id: 'diagram',
                name: 'Diagram DSL',
                description: 'Graph DSL that emits nodes + edges as you stream.',
                input: 'graph{A->B;B->C;A-[fast]->C;}',
                renderer: 'diagram' as const,
                createParser: () => new StreamParser([diagramHandler])
            }
        ]
    }, [markdownEngine, jsonEngine])

    const selectedConfig = exampleConfigs.find((example) => example.id === selectedExample) ?? exampleConfigs[0]

    useEffect(() => {
        setInput(selectedConfig.input)
        setStreamedContent('')
        charIndexRef.current = 0
        setIsStreaming(false)
        setIsPaused(false)
    }, [selectedConfig.input, selectedExample])

    // Load saved test cases from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('md-parser-test-cases')
        if (saved) {
            try {
                setSavedTestCases(JSON.parse(saved))
            } catch {
                // Ignore parse errors
            }
        }
    }, [])

    // Parse the current input/streamed content
    useEffect(() => {
        const parser = selectedConfig.createParser()
        const content = isStreaming ? streamedContent : input
        parser.parse(content)
        setParsedAST(parser.root as unknown)
    }, [input, streamedContent, isStreaming, selectedConfig])

    const clearStreamInterval = useCallback(() => {
        if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current)
            streamIntervalRef.current = null
        }
    }, [])

    const getNextIndex = useCallback(
        (currentIndex: number, mode: 'chars' | 'words', burst: number) => {
            const content = inputRef.current
            if (mode === 'chars') {
                return Math.min(content.length, currentIndex + burst)
            }

            let index = currentIndex
            let wordsConsumed = 0
            while (index < content.length && wordsConsumed < burst) {
                while (index < content.length && /\s/.test(content[index])) {
                    index += 1
                }
                if (index >= content.length) break
                while (index < content.length && !/\s/.test(content[index])) {
                    index += 1
                }
                wordsConsumed += 1
            }
            return Math.min(content.length, index)
        },
        []
    )

    const tickStream = useCallback(() => {
        const nextIndex = getNextIndex(charIndexRef.current, burstMode, burstSize)
        charIndexRef.current = nextIndex
        setStreamedContent(inputRef.current.slice(0, charIndexRef.current))

        if (charIndexRef.current >= inputRef.current.length) {
            clearStreamInterval()
            setIsStreaming(false)
            setIsPaused(false)
        }
    }, [burstMode, burstSize, clearStreamInterval, getNextIndex])

    useEffect(() => {
        if (!isStreaming || isPaused) {
            clearStreamInterval()
            return
        }

        const interval = Math.max(1, Math.floor(1000 / streamSpeed))
        streamIntervalRef.current = window.setInterval(() => {
            tickStream()
        }, interval)

        return () => {
            clearStreamInterval()
        }
    }, [isPaused, isStreaming, streamSpeed, tickStream, clearStreamInterval])

    const startStreaming = useCallback(() => {
        if (isStreaming && !isPaused) return

        if (!isStreaming) {
            setStreamedContent('')
            charIndexRef.current = 0
        }

        setIsStreaming(true)
        setIsPaused(false)
    }, [isPaused, isStreaming])

    const pauseStreaming = useCallback(() => {
        if (!isStreaming) return
        setIsPaused(true)
    }, [isStreaming])

    const stopStreaming = useCallback(() => {
        clearStreamInterval()
        setIsStreaming(false)
        setIsPaused(false)
    }, [clearStreamInterval])

    const resetStreaming = useCallback(() => {
        stopStreaming()
        charIndexRef.current = 0
        setStreamedContent('')
    }, [stopStreaming])

    const saveTestCase = useCallback(() => {
        if (!testCaseName.trim()) return

        const newCase: TestCase = {
            id: crypto.randomUUID(),
            name: testCaseName.trim(),
            input: input,
            description: `Created on ${new Date().toLocaleString()}`
        }

        const updated = [...savedTestCases, newCase]
        setSavedTestCases(updated)
        localStorage.setItem('md-parser-test-cases', JSON.stringify(updated))
        setTestCaseName('')
    }, [testCaseName, input, savedTestCases])

    const loadTestCase = useCallback((testCase: TestCase) => {
        setInput(testCase.input)
        resetStreaming()
    }, [resetStreaming])

    const deleteTestCase = useCallback((id: string) => {
        const updated = savedTestCases.filter(tc => tc.id !== id)
        setSavedTestCases(updated)
        localStorage.setItem('md-parser-test-cases', JSON.stringify(updated))
    }, [savedTestCases])

    const exportTestCases = useCallback(() => {
        const blob = new Blob([JSON.stringify(savedTestCases, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'md-parser-test-cases.json'
        a.click()
        URL.revokeObjectURL(url)
    }, [savedTestCases])

    const importTestCases = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target?.result as string) as TestCase[]
                const merged = [...savedTestCases, ...imported]
                setSavedTestCases(merged)
                localStorage.setItem('md-parser-test-cases', JSON.stringify(merged))
            } catch {
                alert('Failed to parse test cases file')
            }
        }
        reader.readAsText(file)
    }, [savedTestCases])

    const displayContent = isStreaming ? streamedContent : input
    const safeStringify = useCallback((value: unknown) => {
        const seen = new WeakSet()
        return JSON.stringify(value, (_key, val) => {
            if (typeof val === 'object' && val !== null) {
                if (seen.has(val)) return '[Circular]'
                seen.add(val)
            }
            return val
        }, 2)
    }, [])

    type DiagramEdge = { from: string; to: string; label?: string }
    type DiagramModel = { nodes: string[]; edges: DiagramEdge[] }

    const buildDiagramModel = useCallback((node: ParsedNode | null): DiagramModel | null => {
        if (!node) return null
        const diagram = node.children.find(
            (child) => typeof child !== 'string' && child.element === 'diagram'
        ) as ParsedNode | undefined
        if (!diagram) return null

        const nodeItems = diagram.children.filter(
            (child) => typeof child !== 'string' && child.element === 'node'
        ) as ParsedNode[]
        const edgeItems = diagram.children.filter(
            (child) => typeof child !== 'string' && child.element === 'edge'
        ) as ParsedNode[]

        const edges = edgeItems.map((edge) => ({
            from: String(edge.children[0] ?? ''),
            to: String(edge.children[1] ?? ''),
            label: edge.attributes[0]?.label
        }))

        const nodeNames = nodeItems.map((nodeItem) => nodeItem.children.join(''))
        const nodeSet = new Set(nodeNames)
        for (const edge of edges) {
            if (edge.from) nodeSet.add(edge.from)
            if (edge.to) nodeSet.add(edge.to)
        }

        return {
            nodes: Array.from(nodeSet),
            edges
        }
    }, [])

    const DiagramCanvas = ({ model }: { model: DiagramModel | null }) => {
        const canvasRef = useRef<HTMLCanvasElement | null>(null)

        useEffect(() => {
            const canvas = canvasRef.current
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.fillStyle = '#09090b'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            if (!model || model.nodes.length === 0) {
                ctx.fillStyle = '#a1a1aa'
                ctx.font = '14px sans-serif'
                ctx.fillText('Waiting for diagram data…', 16, 32)
                return
            }

            const centerX = canvas.width / 2
            const centerY = canvas.height / 2
            const radius = Math.min(centerX, centerY) - 50
            const positions = model.nodes.map((nodeId, index) => {
                const angle = (index / Math.max(model.nodes.length, 1)) * Math.PI * 2
                return {
                    id: nodeId,
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle)
                }
            })

            const positionMap = new Map(positions.map((pos) => [pos.id, pos]))

            ctx.strokeStyle = '#a1a1aa'
            ctx.lineWidth = 2
            ctx.fillStyle = '#a1a1aa'
            ctx.font = '12px sans-serif'

            const drawArrow = (fromX: number, fromY: number, toX: number, toY: number) => {
                const angle = Math.atan2(toY - fromY, toX - fromX)
                const arrowLength = 10
                const arrowAngle = Math.PI / 6
                ctx.beginPath()
                ctx.moveTo(fromX, fromY)
                ctx.lineTo(toX, toY)
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(toX, toY)
                ctx.lineTo(
                    toX - arrowLength * Math.cos(angle - arrowAngle),
                    toY - arrowLength * Math.sin(angle - arrowAngle)
                )
                ctx.lineTo(
                    toX - arrowLength * Math.cos(angle + arrowAngle),
                    toY - arrowLength * Math.sin(angle + arrowAngle)
                )
                ctx.closePath()
                ctx.fill()
            }

            for (const edge of model.edges) {
                const from = positionMap.get(edge.from)
                const to = positionMap.get(edge.to)
                if (!from || !to) continue
                drawArrow(from.x, from.y, to.x, to.y)
                if (edge.label) {
                    const labelX = (from.x + to.x) / 2
                    const labelY = (from.y + to.y) / 2 - 8
                    ctx.fillStyle = '#e4e4e7'
                    ctx.fillText(edge.label, labelX - ctx.measureText(edge.label).width / 2, labelY)
                    ctx.fillStyle = '#a1a1aa'
                }
            }

            for (const pos of positions) {
                ctx.fillStyle = '#27272a'
                ctx.strokeStyle = '#a78bfa'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2)
                ctx.fill()
                ctx.stroke()
                ctx.fillStyle = '#f4f4f5'
                ctx.font = '12px sans-serif'
                const textWidth = ctx.measureText(pos.id).width
                ctx.fillText(pos.id, pos.x - textWidth / 2, pos.y + 4)
            }
        }, [model])

        return (
            <canvas
                ref={canvasRef}
                width={440}
                height={260}
                className="w-full h-[260px] rounded-lg border border-zinc-800"
            />
        )
    }

    const renderJson = useCallback((node: unknown) => {
        type JsonRenderableNode = {
            element: string
            children: Array<JsonRenderableNode | string>
            attributes: Record<string, unknown> | Array<Record<string, unknown>>
        }

        const isJsonNode = (value: unknown): value is JsonRenderableNode => {
            if (typeof value !== 'object' || value === null) return false
            const maybe = value as Partial<JsonRenderableNode>
            return typeof maybe.element === 'string' && Array.isArray(maybe.children)
        }

        const getNodeType = (jsonNode: JsonRenderableNode): string | undefined => {
            if (Array.isArray(jsonNode.attributes)) {
                const first = jsonNode.attributes[0]
                return typeof first?.type === 'string' ? first.type : undefined
            }
            const typed = jsonNode.attributes as { type?: unknown }
            return typeof typed.type === 'string' ? typed.type : undefined
        }

        if (!isJsonNode(node)) return 'No JSON parsed yet.'

        const jsonNode = node.children.find(
            (child): child is JsonRenderableNode =>
                isJsonNode(child) && child.element === 'json'
        )
        if (!jsonNode || jsonNode.children.length === 0) return 'No JSON parsed yet.'

        const buildValue = (valueNode: JsonRenderableNode): unknown => {
            if (valueNode.element === 'object') {
                const obj: Record<string, unknown> = {}
                for (const child of valueNode.children) {
                    if (!isJsonNode(child) || child.element !== 'pair') continue

                    const keyNode = child.children[0]
                    const key =
                        typeof keyNode === 'string'
                            ? keyNode
                            : isJsonNode(keyNode)
                                ? String(buildValue(keyNode))
                                : ''

                    const rawValue = child.children[1]
                    if (typeof rawValue === 'string') {
                        obj[key] = rawValue
                    } else if (isJsonNode(rawValue)) {
                        obj[key] = buildValue(rawValue)
                    } else {
                        obj[key] = null
                    }
                }
                return obj
            }

            if (valueNode.element === 'array') {
                return valueNode.children.map((child) =>
                    typeof child === 'string' ? child : buildValue(child)
                )
            }

            if (valueNode.element === 'value') {
                const raw = valueNode.children.join('')
                const type = getNodeType(valueNode)
                if (type === 'null') return null
                if (type === 'boolean') return raw === 'true'
                if (type === 'number') {
                    const asNumber = Number(raw)
                    return Number.isNaN(asNumber) ? raw : asNumber
                }
                if (type === 'string') return raw
                if (type === 'primitive') {
                    if (raw === 'true') return true
                    if (raw === 'false') return false
                    if (raw === 'null') return null
                    const asNumber = Number(raw)
                    if (!Number.isNaN(asNumber)) return asNumber
                    return raw
                }
                return raw
            }

            return valueNode.children.join('')
        }

        const rootValue = jsonNode.children.find(
            (child): child is JsonRenderableNode =>
                isJsonNode(child) && (child.element === 'object' || child.element === 'array')
        )

        if (!rootValue) return 'No JSON parsed yet.'
        return JSON.stringify(buildValue(rootValue), null, 2)
    }, [])

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Input & Controls */}
            <div className="space-y-4">
                {/* Streaming Controls */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-zinc-400 mb-3">Streaming Simulation</h2>

                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <button
                            onClick={isStreaming && !isPaused ? pauseStreaming : startStreaming}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${isStreaming && !isPaused
                                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                }`}
                        >
                            {isStreaming && !isPaused ? '⏸ Pause' : isPaused ? '▶ Resume' : '▶ Start'}
                        </button>

                        <button
                            onClick={stopStreaming}
                            className="px-4 py-2 rounded-lg font-medium text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all"
                        >
                            ⏹ Stop
                        </button>

                        <button
                            onClick={resetStreaming}
                            className="px-4 py-2 rounded-lg font-medium text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition-all"
                        >
                            ↺ Reset
                        </button>

                        <div className="flex items-center gap-2 ml-auto">
                            <label className="text-xs text-zinc-500">Speed:</label>
                            <input
                                type="range"
                                min="10"
                                max="200"
                                value={streamSpeed}
                                onChange={(e) => setStreamSpeed(Number(e.target.value))}
                                className="w-24 accent-violet-500"
                            />
                            <span className="text-xs text-zinc-400 w-16">{streamSpeed} c/s</span>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex items-center gap-2 text-xs text-zinc-400">
                            Burst mode
                            <select
                                value={burstMode}
                                onChange={(e) => setBurstMode(e.target.value as 'chars' | 'words')}
                                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs"
                            >
                                <option value="chars">Chars</option>
                                <option value="words">Words</option>
                            </select>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-400">
                            Burst size
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={burstSize}
                                onChange={(e) => setBurstSize(Math.max(1, Number(e.target.value)))}
                                className="w-16 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs"
                            />
                        </label>
                    </div>

                    {(isStreaming || isPaused) && (
                        <div className="flex items-center gap-2">
                            <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-100"
                                    style={{ width: `${(charIndexRef.current / input.length) * 100}%` }}
                                />
                            </div>
                            <span className="text-xs text-zinc-500 font-mono">
                                {charIndexRef.current}/{input.length}
                            </span>
                        </div>
                    )}
                </div>

                {/* Markdown Input */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3 gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-400">Input</h2>
                            <p className="text-xs text-zinc-500">
                                {selectedConfig.description}
                                {selectedExample === 'markdown' ? ` | engine: ${markdownEngine}` : ''}
                                {selectedExample === 'json' ? ` | engine: ${jsonEngine}` : ''}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedExample === 'markdown' && (
                                <select
                                    value={markdownEngine}
                                    onChange={(e) => setMarkdownEngine(e.target.value as MarkdownEngine)}
                                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs"
                                >
                                    <option value="stable">Stable</option>
                                    <option value="experimental-v2">Experimental v2</option>
                                </select>
                            )}
                            {selectedExample === 'json' && (
                                <select
                                    value={jsonEngine}
                                    onChange={(e) => setJsonEngine(e.target.value as JsonEngine)}
                                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs"
                                >
                                    <option value="stable">JSON Stable</option>
                                    <option value="experimental-v2">JSON Experimental v2</option>
                                </select>
                            )}
                            <select
                                value={selectedExample}
                                onChange={(e) => setSelectedExample(e.target.value)}
                                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs"
                            >
                                {exampleConfigs.map((example) => (
                                    <option key={example.id} value={example.id}>
                                        {example.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isStreaming}
                        className="w-full h-64 bg-zinc-950 text-zinc-100 font-mono text-sm p-3 rounded-lg border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none resize-none disabled:opacity-50"
                        placeholder="Enter content here..."
                    />
                </div>

                {/* Test Case Manager */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-zinc-400 mb-3">Test Cases</h2>

                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={testCaseName}
                            onChange={(e) => setTestCaseName(e.target.value)}
                            placeholder="Test case name..."
                            className="flex-1 bg-zinc-950 text-zinc-100 text-sm px-3 py-2 rounded-lg border border-zinc-800 focus:border-violet-500 outline-none"
                        />
                        <button
                            onClick={saveTestCase}
                            disabled={!testCaseName.trim()}
                            className="px-4 py-2 rounded-lg font-medium text-sm bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Save
                        </button>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={exportTestCases}
                            disabled={savedTestCases.length === 0}
                            className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:opacity-50 transition-all"
                        >
                            Export JSON
                        </button>
                        <label className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 cursor-pointer transition-all">
                            Import JSON
                            <input type="file" accept=".json" onChange={importTestCases} className="hidden" />
                        </label>
                    </div>

                    {savedTestCases.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {savedTestCases.map((tc) => (
                                <div
                                    key={tc.id}
                                    className="flex items-center justify-between bg-zinc-950 rounded-lg p-2 group"
                                >
                                    <button
                                        onClick={() => loadTestCase(tc)}
                                        className="text-sm text-zinc-300 hover:text-white truncate flex-1 text-left"
                                    >
                                        {tc.name}
                                    </button>
                                    <button
                                        onClick={() => deleteTestCase(tc.id)}
                                        className="text-xs text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all ml-2"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Output */}
            <div className="space-y-4">
                {/* Rendered Output */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-zinc-400 mb-3">Rendered Output</h2>
                    {selectedConfig.renderer === 'markdown' ? (
                        <div className="bg-white text-zinc-800 rounded-lg p-4 min-h-[200px]">
                            <MarkdownStreamRenderer content={displayContent} engine={markdownEngine} />
                        </div>
                    ) : selectedConfig.renderer === 'diagram' ? (
                        <div className="bg-zinc-950 text-zinc-100 rounded-lg p-4 min-h-[200px]">
                            <DiagramCanvas model={buildDiagramModel(parsedAST as ParsedNode | null)} />
                        </div>
                    ) : selectedConfig.renderer === 'json' ? (
                        <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 min-h-[200px] text-sm whitespace-pre-wrap">
                            {renderJson(parsedAST)}
                        </pre>
                    ) : (
                        <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 min-h-[200px] text-sm whitespace-pre-wrap">
                            {displayContent}
                        </pre>
                    )}
                </div>

                {/* AST View */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-zinc-400 mb-3">Parsed AST</h2>
                    <pre className="bg-zinc-950 text-emerald-400 font-mono text-xs p-4 rounded-lg overflow-auto max-h-96 border border-zinc-800">
                        {parsedAST ? safeStringify(parsedAST) : 'No content parsed'}
                    </pre>
                </div>
            </div>
        </div>
    )
}
