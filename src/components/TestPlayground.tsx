import { useState, useRef, useCallback, useEffect } from 'react'
import { MarkdownStreamParser, ParsedMDNode } from '../lib'
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
    const [streamSpeed, setStreamSpeed] = useState(50) // chars per second
    const [parsedAST, setParsedAST] = useState<ParsedMDNode | null>(null)
    const [savedTestCases, setSavedTestCases] = useState<TestCase[]>([])
    const [testCaseName, setTestCaseName] = useState('')

    const streamIntervalRef = useRef<number | null>(null)
    const charIndexRef = useRef(0)

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
        const parser = new MarkdownStreamParser()
        const content = isStreaming ? streamedContent : input
        parser.parse(content)
        setParsedAST(parser.root)
    }, [input, streamedContent, isStreaming])

    const startStreaming = useCallback(() => {
        if (isStreaming) return

        setIsStreaming(true)
        setStreamedContent('')
        charIndexRef.current = 0

        const interval = 1000 / streamSpeed
        streamIntervalRef.current = window.setInterval(() => {
            if (charIndexRef.current >= input.length) {
                if (streamIntervalRef.current) {
                    clearInterval(streamIntervalRef.current)
                    streamIntervalRef.current = null
                }
                setIsStreaming(false)
                return
            }

            charIndexRef.current++
            setStreamedContent(input.slice(0, charIndexRef.current))
        }, interval)
    }, [input, streamSpeed, isStreaming])

    const stopStreaming = useCallback(() => {
        if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current)
            streamIntervalRef.current = null
        }
        setIsStreaming(false)
        setStreamedContent('')
    }, [])

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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Input & Controls */}
            <div className="space-y-4">
                {/* Streaming Controls */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-zinc-400 mb-3">Streaming Simulation</h2>

                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={isStreaming ? stopStreaming : startStreaming}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${isStreaming
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                }`}
                        >
                            {isStreaming ? '⏹ Stop' : '▶ Start'}
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

                    {isStreaming && (
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
                    <h2 className="text-sm font-semibold text-zinc-400 mb-3">Markdown Input</h2>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isStreaming}
                        className="w-full h-64 bg-zinc-950 text-zinc-100 font-mono text-sm p-3 rounded-lg border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none resize-none disabled:opacity-50"
                        placeholder="Enter markdown here..."
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
                    <div className="bg-white text-zinc-800 rounded-lg p-4 min-h-[200px]">
                        <MarkdownStreamRenderer content={displayContent} />
                    </div>
                </div>

                {/* AST View */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-zinc-400 mb-3">Parsed AST</h2>
                    <pre className="bg-zinc-950 text-emerald-400 font-mono text-xs p-4 rounded-lg overflow-auto max-h-96 border border-zinc-800">
                        {parsedAST ? JSON.stringify(parsedAST, null, 2) : 'No content parsed'}
                    </pre>
                </div>
            </div>
        </div>
    )
}
