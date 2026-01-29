import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
    createMarkdownParser,
    StreamParser,
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
    const [parsedAST, setParsedAST] = useState<ParsedNode | null>(null)
    const [savedTestCases, setSavedTestCases] = useState<TestCase[]>([])
    const [testCaseName, setTestCaseName] = useState('')
    const [selectedExample, setSelectedExample] = useState('markdown')

    const streamIntervalRef = useRef<number | null>(null)
    const charIndexRef = useRef(0)
    const inputRef = useRef(input)

    useEffect(() => {
        inputRef.current = input
    }, [input])

    const exampleConfigs = useMemo(() => {
        const jsonStateMap = new WeakMap<ParsedNode, {
            stack: Array<{
                node: ParsedNode
                type: 'object' | 'array'
                expectingKey: boolean
                currentPair: ParsedNode | null
            }>
            currentKey: string | null
            buffer: string
            inString: boolean
            isEscaped: boolean
            stringValueTarget: 'key' | 'value' | null
        }>()
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

        const jsonHandler: PatternHandler = {
            name: 'json',
            elementName: 'json',
            allowedNestings: [],
            start: (buffer) => {
                if (buffer.endsWith('{') || buffer.endsWith('[')) return 'commit'
                return 'no'
            },
            prefixLength: () => 1,
            commit: () => '',
            feed: (char, node) => {
                if (!jsonStateMap.has(node)) {
                    jsonStateMap.set(node, {
                        stack: [],
                        currentKey: null,
                        buffer: '',
                        inString: false,
                        isEscaped: false,
                        stringValueTarget: null
                    })
                }
                const state = jsonStateMap.get(node)!

                const currentContainer = () => state.stack[state.stack.length - 1]

                const flushBuffer = () => {
                    const value = state.buffer.trim()
                    if (!value) return
                    const container = currentContainer()
                    if (!container) {
                        state.buffer = ''
                        return
                    }
                    const valueNode: ParsedNode = {
                        element: 'value',
                        children: [value],
                        attributes: [{ type: 'primitive' }]
                    }
                    if (container.type === 'object' && container.currentPair) {
                        container.currentPair.children[1] = valueNode
                        container.currentPair = null
                        container.expectingKey = true
                    } else if (container.type === 'array') {
                        container.node.children.push(valueNode)
                    }
                    state.buffer = ''
                }

                if (state.inString) {
                    if (state.isEscaped) {
                        state.buffer += char
                        state.isEscaped = false
                        return false
                    }
                    if (char === '\\') {
                        state.isEscaped = true
                        return false
                    }
                    if (char === '"') {
                        state.inString = false
                        const container = currentContainer()
                        if (state.stringValueTarget === 'key' && container?.type === 'object') {
                            const key = state.buffer
                            const pair: ParsedNode = {
                                element: 'pair',
                                children: [
                                    key,
                                    {
                                        element: 'value',
                                        children: ['null'],
                                        attributes: [{ type: 'null' }]
                                    }
                                ],
                                attributes: []
                            }
                            container.node.children.push(pair)
                            container.currentPair = pair
                            container.expectingKey = false
                            state.currentKey = key
                            state.buffer = ''
                            state.stringValueTarget = null
                            return false
                        }
                        if (state.stringValueTarget === 'value' && container) {
                            const valueNode: ParsedNode = {
                                element: 'value',
                                children: [state.buffer],
                                attributes: [{ type: 'string' }]
                            }
                            if (container.type === 'object' && container.currentPair) {
                                container.currentPair.children[1] = valueNode
                                container.currentPair = null
                                container.expectingKey = true
                            } else if (container.type === 'array') {
                                container.node.children.push(valueNode)
                            }
                            state.buffer = ''
                            state.stringValueTarget = null
                            return false
                        }
                        state.buffer = ''
                        return false
                    }
                    state.buffer += char
                    return false
                }

                if (char === '"') {
                    state.inString = true
                    const container = currentContainer()
                    if (container?.type === 'object' && container.expectingKey) {
                        state.stringValueTarget = 'key'
                    } else {
                        state.stringValueTarget = 'value'
                    }
                    return false
                }

                if (char === '{') {
                    flushBuffer()
                    const obj: ParsedNode = { element: 'object', children: [], attributes: [] }
                    const container = currentContainer()
                    if (!container) {
                        node.children.push(obj)
                    } else if (container.type === 'object' && container.currentPair) {
                        container.currentPair.children[1] = obj
                        container.currentPair = null
                        container.expectingKey = true
                    } else if (container.type === 'array') {
                        container.node.children.push(obj)
                    }
                    state.stack.push({ node: obj, type: 'object', expectingKey: true, currentPair: null })
                    return false
                }

                if (char === '[') {
                    flushBuffer()
                    const arr: ParsedNode = { element: 'array', children: [], attributes: [] }
                    const container = currentContainer()
                    if (!container) {
                        node.children.push(arr)
                    } else if (container.type === 'object' && container.currentPair) {
                        container.currentPair.children[1] = arr
                        container.currentPair = null
                        container.expectingKey = true
                    } else if (container.type === 'array') {
                        container.node.children.push(arr)
                    }
                    state.stack.push({ node: arr, type: 'array', expectingKey: false, currentPair: null })
                    return false
                }

                if (char === '}' || char === ']') {
                    flushBuffer()
                    state.stack.pop()
                    if (state.stack.length === 0) {
                        return true
                    }
                    return false
                }

                if (char === ':' || char === ',') {
                    flushBuffer()
                    const container = currentContainer()
                    if (char === ',' && container?.type === 'object') {
                        container.expectingKey = true
                    }
                    return false
                }

                if (!/\s/.test(char)) {
                    state.buffer += char
                    const container = currentContainer()
                    if (container?.type === 'object' && container.currentPair) {
                        container.currentPair.children[1] = {
                            element: 'value',
                            children: [state.buffer.trim()],
                            attributes: [{ type: 'primitive' }]
                        }
                    }
                }

                return false
            }
        }

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
                name: 'Markdown (with images)',
                description: 'Markdown parser extended with image tokens.',
                input: EXAMPLE_MARKDOWN,
                renderer: 'markdown' as const,
                createParser: () => createMarkdownParser([imageExtension])
            },
            {
                id: 'json',
                name: 'Streaming JSON',
                description: 'Incremental JSON collector with nested objects/arrays.',
                input: '{\"user\":{\"id\":1,\"tags\":[\"alpha\",\"beta\"],\"ok\":true}}',
                renderer: 'json' as const,
                createParser: () => new StreamParser([jsonHandler])
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
    }, [])

    const selectedConfig = exampleConfigs.find((example) => example.id === selectedExample) ?? exampleConfigs[0]

    useEffect(() => {
        setInput(selectedConfig.input)
        setStreamedContent('')
        charIndexRef.current = 0
        setIsStreaming(false)
        setIsPaused(false)
    }, [selectedConfig])

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
        setParsedAST(parser.root)
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

    const renderDiagram = useCallback((node: ParsedNode | null) => {
        if (!node) return null
        const diagram = node.children.find(
            (child) => typeof child !== 'string' && child.element === 'diagram'
        ) as ParsedNode | undefined
        if (!diagram) {
            return <div className="text-zinc-500 text-sm">No diagram parsed yet.</div>
        }

        const nodes = diagram.children.filter(
            (child) => typeof child !== 'string' && child.element === 'node'
        ) as ParsedNode[]
        const edges = diagram.children.filter(
            (child) => typeof child !== 'string' && child.element === 'edge'
        ) as ParsedNode[]

        const radius = 140
        const centerX = 220
        const centerY = 180
        const positions = nodes.map((nodeItem, index) => {
            const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2
            return {
                id: nodeItem.children.join(''),
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            }
        })

        const positionMap = new Map(positions.map((pos) => [pos.id, pos]))

        return (
            <svg viewBox="0 0 440 360" className="w-full h-[260px]">
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" fill="#a1a1aa" />
                    </marker>
                </defs>
                {edges.map((edge, index) => {
                    const fromId = edge.children[0] as string
                    const toId = edge.children[1] as string
                    const from = positionMap.get(fromId)
                    const to = positionMap.get(toId)
                    if (!from || !to) return null
                    return (
                        <g key={`${fromId}-${toId}-${index}`}>
                            <line
                                x1={from.x}
                                y1={from.y}
                                x2={to.x}
                                y2={to.y}
                                stroke="#a1a1aa"
                                strokeWidth="2"
                                markerEnd="url(#arrow)"
                            />
                            {edge.attributes[0]?.label && (
                                <text
                                    x={(from.x + to.x) / 2}
                                    y={(from.y + to.y) / 2 - 6}
                                    fill="#e4e4e7"
                                    fontSize="10"
                                    textAnchor="middle"
                                >
                                    {edge.attributes[0].label}
                                </text>
                            )}
                        </g>
                    )
                })}
                {positions.map((pos) => (
                    <g key={pos.id}>
                        <circle cx={pos.x} cy={pos.y} r="20" fill="#27272a" stroke="#a78bfa" strokeWidth="2" />
                        <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#f4f4f5" fontSize="12">
                            {pos.id}
                        </text>
                    </g>
                ))}
            </svg>
        )
    }, [])

    const renderJson = useCallback((node: ParsedNode | null) => {
        if (!node) return 'No JSON parsed yet.'
        const jsonNode = node.children.find(
            (child) => typeof child !== 'string' && child.element === 'json'
        ) as ParsedNode | undefined
        if (!jsonNode || jsonNode.children.length === 0) return 'No JSON parsed yet.'

        const buildValue = (valueNode: ParsedNode): unknown => {
            if (valueNode.element === 'object') {
                const obj: Record<string, unknown> = {}
                for (const child of valueNode.children) {
                    if (typeof child === 'string') continue
                    if (child.element === 'pair') {
                        const key = String(child.children[0] ?? '')
                        const rawValue = child.children[1]
                        if (typeof rawValue === 'string') {
                            obj[key] = rawValue
                        } else if (rawValue) {
                            obj[key] = buildValue(rawValue)
                        } else {
                            obj[key] = null
                        }
                    }
                }
                return obj
            }
            if (valueNode.element === 'array') {
                const arr: unknown[] = []
                for (const child of valueNode.children) {
                    if (typeof child === 'string') {
                        arr.push(child)
                    } else {
                        arr.push(buildValue(child))
                    }
                }
                return arr
            }
            if (valueNode.element === 'value') {
                const raw = valueNode.children.join('')
                const type = valueNode.attributes[0]?.type
                if (type === 'null') return null
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
            (child) => typeof child !== 'string' && (child.element === 'object' || child.element === 'array')
        ) as ParsedNode | undefined

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
                            <p className="text-xs text-zinc-500">{selectedConfig.description}</p>
                        </div>
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
                            <MarkdownStreamRenderer content={displayContent} />
                        </div>
                    ) : selectedConfig.renderer === 'diagram' ? (
                        <div className="bg-zinc-950 text-zinc-100 rounded-lg p-4 min-h-[200px]">
                            {renderDiagram(parsedAST)}
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
