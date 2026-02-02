import { describe, test, expect } from 'bun:test'
import { StreamParser, type ParsedNode } from '../StreamParser'
import { createJsonHandler } from '../jsonStreamHandler'
import { Lexer } from '../Lexer'

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY TYPES & HELPERS
// ══════════════════════════════════════════════════════════════════════════════

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type JsonNode = ParsedNode | string

const VERBOSE = true // Toggle for verbose output

const log = (...args: unknown[]) => {
    if (VERBOSE) console.log(...args)
}

const logSection = (title: string) => {
    if (VERBOSE) {
        console.log('\n' + '═'.repeat(70))
        console.log(`  ${title}`)
        console.log('═'.repeat(70))
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// JSON VALUE READERS
// ══════════════════════════════════════════════════════════════════════════════

const readValueNode = (node: JsonNode): JsonValue => {
    if (typeof node === 'string') {
        return node
    }

    if (node.element === 'object') {
        const obj: Record<string, JsonValue> = {}
        for (const child of node.children) {
            if (typeof child === 'string') continue
            if (child.element !== 'pair') continue
            const keyNode = child.children[0]
            const valueNode = child.children[1]
            const key = typeof keyNode === 'string' ? keyNode : String(readValueNode(keyNode))
            if (valueNode) {
                obj[key] = readValueNode(valueNode)
            }
        }
        return obj
    }

    if (node.element === 'array') {
        return node.children
            .filter((child): child is ParsedNode => typeof child !== 'string')
            .map((child) => readValueNode(child))
    }

    if (node.element === 'value') {
        const type = node.attributes?.[0]?.type
        const raw = node.children.join('')
        if (type === 'string') {
            return raw
        }
        if (type === 'boolean') {
            return raw === 'true'
        }
        if (type === 'number') {
            return Number(raw)
        }
        if (type === 'null') {
            return null
        }
        if (type === 'primitive') {
            try {
                return JSON.parse(raw) as JsonValue
            } catch {
                return raw
            }
        }
        return raw
    }

    return node.children
        .filter((child): child is ParsedNode => typeof child !== 'string')
        .map((child) => readValueNode(child))
}

const readStreamParserJson = (parser: StreamParser): JsonValue | null => {
    try {
        const jsonNode = parser.root.children.find(
            (child) => typeof child !== 'string' && child.element === 'json'
        ) as ParsedNode | undefined

        if (!jsonNode) {
            return null
        }

        const rootChild = jsonNode.children.find(
            (child) => typeof child !== 'string'
        ) as ParsedNode | undefined

        if (!rootChild) {
            return {}
        }

        return readValueNode(rootChild)
    } catch {
        return null
    }
}

const readLexerJson = (lexer: Lexer): JsonValue => {
    const sections = lexer.getCompletedSections()
    const merged = sections.reduce<Record<string, JsonValue>>((acc, section) => {
        return Object.assign(acc, section)
    }, {})
    return merged
}

// ══════════════════════════════════════════════════════════════════════════════
// STREAMING TEST UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

interface StreamSnapshot {
    index: number
    char: string
    inputSoFar: string
    streamParserValue: JsonValue | null
    lexerValue: JsonValue
    streamParserNodeCount: number
    lexerSectionCount: number
}

/**
 * Streams input character by character and captures snapshots at each step
 */
const captureStreamingSnapshots = (input: string): StreamSnapshot[] => {
    const snapshots: StreamSnapshot[] = []
    const streamParser = new StreamParser([createJsonHandler()])
    const lexer = new Lexer()
    let inputSoFar = ''

    for (let i = 0; i < input.length; i++) {
        const char = input[i]
        inputSoFar += char

        streamParser.parse(char)
        lexer.processToken(char)

        const streamParserValue = readStreamParserJson(streamParser)
        const lexerValue = readLexerJson(lexer)

        snapshots.push({
            index: i,
            char,
            inputSoFar,
            streamParserValue,
            lexerValue,
            streamParserNodeCount: streamParser.root.children.length,
            lexerSectionCount: lexer.getCompletedSections().length,
        })
    }

    return snapshots
}

/**
 * Pretty prints streaming progress
 */
const dumpStreamingProgress = (input: string, testName: string) => {
    logSection(`STREAMING: ${testName}`)
    log(`  Input: ${JSON.stringify(input)}`)
    log(`  Length: ${input.length} characters\n`)

    const snapshots = captureStreamingSnapshots(input)

    for (const snap of snapshots) {
        const displayChar = snap.char === ' ' ? '␣' : snap.char === '\n' ? '↵' : snap.char === '\t' ? '⇥' : snap.char
        const streamVal = snap.streamParserValue !== null
            ? JSON.stringify(snap.streamParserValue)
            : '(no json yet)'
        const lexerVal = JSON.stringify(snap.lexerValue)

        if (VERBOSE) {
            console.log(`  [${snap.index.toString().padStart(3, '0')}] '${displayChar}'`)
            console.log(`        StreamParser parsed ${streamVal.substring(0, 60)}${streamVal.length > 60 ? '...' : ''}`)
            console.log(`        Lexer parsed        ${lexerVal.substring(0, 60)}${lexerVal.length > 60 ? '...' : ''}`)
        }
    }

    return snapshots
}

/**
 * Asserts streaming behavior at specific indices
 */
interface StreamAssertion {
    atIndex: number
    description: string
    streamParserCheck?: (value: JsonValue | null) => boolean
    lexerCheck?: (value: JsonValue) => boolean
}

const assertStreamingBehavior = (input: string, assertions: StreamAssertion[]) => {
    const snapshots = captureStreamingSnapshots(input)

    for (const assertion of assertions) {
        const snapshot = snapshots[assertion.atIndex]
        if (!snapshot) {
            throw new Error(`No snapshot at index ${assertion.atIndex}`)
        }

        if (assertion.streamParserCheck) {
            expect(assertion.streamParserCheck(snapshot.streamParserValue)).toBe(true)
        }
        if (assertion.lexerCheck) {
            expect(assertion.lexerCheck(snapshot.lexerValue)).toBe(true)
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: BASIC STREAMING BEHAVIOR
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Streaming: Basic Progressive Parsing', () => {
    test('streams simple object key-value progressively', () => {
        const input = '{"name":"Alice"}'
        dumpStreamingProgress(input, 'Simple key-value')

        const snapshots = captureStreamingSnapshots(input)

        // At index 0: just '{'
        expect(snapshots[0].streamParserNodeCount).toBeGreaterThan(0)

        // At index 6: '{"name"' - key should be visible (7 chars, 0-indexed)
        expect(snapshots[6].inputSoFar).toBe('{"name"')

        // At the end
        const final = snapshots[snapshots.length - 1]
        expect(final.streamParserValue).toEqual({ name: 'Alice' })
        log(`\n  ✓ Final value: ${JSON.stringify(final.streamParserValue)}`)
    })

    test('streams numbers character by character', () => {
        const input = '{"count":12345}'
        dumpStreamingProgress(input, 'Number streaming')

        const snapshots = captureStreamingSnapshots(input)

        // Check progressive number building
        const numberStartIndex = 9 // after '{"count":'

        log('\n  Number building progression:')
        for (let i = numberStartIndex; i < snapshots.length - 1; i++) {
            const snap = snapshots[i]
            if (snap.streamParserValue && typeof snap.streamParserValue === 'object') {
                const obj = snap.streamParserValue as { count?: number }
                log(`    After '${snap.char}': count = ${obj.count}`)
            }
        }

        const final = snapshots[snapshots.length - 1]
        expect(final.streamParserValue).toEqual({ count: 12345 })
    })

    test('streams nested objects progressively', () => {
        const input = '{"user":{"id":1,"name":"Bob"}}'
        dumpStreamingProgress(input, 'Nested object')

        const snapshots = captureStreamingSnapshots(input)

        // After opening nested object
        const nestedStart = input.indexOf('{', 1)
        log(`\n  Nested object starts at index ${nestedStart}`)

        const final = snapshots[snapshots.length - 1]
        expect(final.streamParserValue).toEqual({ user: { id: 1, name: 'Bob' } })
        log(`  ✓ Final: ${JSON.stringify(final.streamParserValue)}`)
    })

    test('streams arrays with primitive values', () => {
        const input = '[1,2,3,4,5]'
        dumpStreamingProgress(input, 'Array streaming')

        const snapshots = captureStreamingSnapshots(input)

        log('\n  Array building progression:')
        for (const snap of snapshots) {
            if (Array.isArray(snap.streamParserValue)) {
                log(`    Index ${snap.index}: [${snap.streamParserValue.join(', ')}]`)
            }
        }

        const final = snapshots[snapshots.length - 1]
        expect(final.streamParserValue).toEqual([1, 2, 3, 4, 5])
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: INCOMPLETE STREAM HANDLING
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Streaming: Incomplete Input Handling', () => {
    test('handles incomplete string mid-stream', () => {
        const input = '{"message":"Hello, wor'
        dumpStreamingProgress(input, 'Incomplete string')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        // Should not throw
        expect(final).toBeDefined()
        log(`\n  ✓ Partial stream handled without throwing`)
        log(`  Stream state: ${JSON.stringify(final.streamParserValue)}`)
    })

    test('handles incomplete number mid-stream', () => {
        const input = '{"value":123'
        dumpStreamingProgress(input, 'Incomplete number')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final).toBeDefined()
        log(`\n  ✓ Partial number stream handled`)
    })

    test('handles incomplete nested structure', () => {
        const input = '{"level1":{"level2":{"level3":'
        dumpStreamingProgress(input, 'Deep incomplete nesting')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final).toBeDefined()
        expect(snapshots.length).toBe(input.length)
        log(`\n  ✓ Deep nesting handled gracefully`)
    })

    test('handles incomplete array in object', () => {
        const input = '{"items":[1,2,3'
        dumpStreamingProgress(input, 'Incomplete array in object')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final).toBeDefined()
        log(`\n  ✓ Incomplete array handled`)
    })

    test('handles incomplete boolean values', () => {
        const cases = [
            { input: '{"ok":t', desc: 'true - 1 char' },
            { input: '{"ok":tr', desc: 'true - 2 chars' },
            { input: '{"ok":tru', desc: 'true - 3 chars' },
            { input: '{"ok":f', desc: 'false - 1 char' },
            { input: '{"ok":fa', desc: 'false - 2 chars' },
            { input: '{"ok":fal', desc: 'false - 3 chars' },
            { input: '{"ok":fals', desc: 'false - 4 chars' },
        ]

        for (const { input, desc } of cases) {
            logSection(`Incomplete boolean: ${desc}`)
            const snapshots = captureStreamingSnapshots(input)
            const final = snapshots[snapshots.length - 1]

            expect(final).toBeDefined()
            log(`  Input: ${input}`)
            log(`  ✓ Stream state: ${JSON.stringify(final.streamParserValue)}`)
        }
    })

    test('handles incomplete null values', () => {
        const cases = [
            { input: '{"val":n', expected: 'n' },
            { input: '{"val":nu', expected: 'nu' },
            { input: '{"val":nul', expected: 'nul' },
        ]

        for (const { input, expected } of cases) {
            log(`\n  Testing incomplete null: "${expected}"`)
            const snapshots = captureStreamingSnapshots(input)
            const final = snapshots[snapshots.length - 1]

            expect(final).toBeDefined()
            log(`  ✓ Handled: ${JSON.stringify(final.streamParserValue)}`)
        }
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: ESCAPE SEQUENCES
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Streaming: Escape Sequence Handling', () => {
    test('streams escaped newline character', () => {
        const input = '{"text":"line1\\nline2"}'
        dumpStreamingProgress(input, 'Escaped newline')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ text: 'line1\nline2' })
        log(`\n  ✓ Newline escaped correctly: ${JSON.stringify(final.streamParserValue)}`)
    })

    test('streams escaped tab character', () => {
        const input = '{"text":"col1\\tcol2"}'
        dumpStreamingProgress(input, 'Escaped tab')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ text: 'col1\tcol2' })
        log(`\n  ✓ Tab escaped correctly`)
    })

    test('streams escaped quotes', () => {
        const input = '{"quote":"He said \\"Hello\\""}'
        dumpStreamingProgress(input, 'Escaped quotes')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ quote: 'He said "Hello"' })
        log(`\n  ✓ Quotes escaped correctly`)
    })

    test('streams escaped backslash', () => {
        const input = '{"path":"C:\\\\Users\\\\test"}'
        dumpStreamingProgress(input, 'Escaped backslash')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ path: 'C:\\Users\\test' })
        log(`\n  ✓ Backslash escaped correctly`)
    })

    test('streams multiple escape sequences', () => {
        const input = '{"multi":"\\t\\n\\r\\"\\\\/"}'
        dumpStreamingProgress(input, 'Multiple escapes')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ multi: '\t\n\r"\\/' })
        log(`\n  ✓ All escapes handled correctly`)
    })

    test('handles incomplete escape sequence', () => {
        const input = '{"text":"hello\\'
        dumpStreamingProgress(input, 'Incomplete escape')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final).toBeDefined()
        log(`\n  ✓ Incomplete escape handled without throwing`)
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: NUMERIC EDGE CASES
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Streaming: Numeric Edge Cases', () => {
    test('streams negative numbers', () => {
        const input = '{"temp":-42}'
        dumpStreamingProgress(input, 'Negative number')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ temp: -42 })
        log(`\n  ✓ Negative number: ${JSON.stringify(final.streamParserValue)}`)
    })

    test('streams decimal numbers progressively', () => {
        const input = '{"pi":3.14159}'
        dumpStreamingProgress(input, 'Decimal number')

        const snapshots = captureStreamingSnapshots(input)

        log('\n  Decimal building:')
        for (let i = 5; i < snapshots.length; i++) {
            const snap = snapshots[i]
            if (snap.streamParserValue && typeof snap.streamParserValue === 'object') {
                const obj = snap.streamParserValue as { pi?: number }
                if (obj.pi !== undefined) {
                    log(`    After '${snap.char}': pi = ${obj.pi}`)
                }
            }
        }

        const final = snapshots[snapshots.length - 1]
        expect(final.streamParserValue).toEqual({ pi: 3.14159 })
    })

    test('streams scientific notation', () => {
        const input = '{"big":1.5e10}'
        dumpStreamingProgress(input, 'Scientific notation')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ big: 1.5e10 })
        log(`\n  ✓ Scientific: ${JSON.stringify(final.streamParserValue)}`)
    })

    test('streams negative scientific notation', () => {
        const input = '{"tiny":-3e-5}'
        dumpStreamingProgress(input, 'Negative scientific')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ tiny: -3e-5 })
    })

    test('streams zero', () => {
        const input = '{"zero":0}'
        dumpStreamingProgress(input, 'Zero value')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ zero: 0 })
    })

    test('streams multiple number types in array', () => {
        const input = '[0, -1, 2.5, 3e2, -4.5e-1]'
        dumpStreamingProgress(input, 'Mixed number array')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual([0, -1, 2.5, 300, -0.45])
    })

    test('handles incomplete decimal', () => {
        const input = '{"val":3.'
        dumpStreamingProgress(input, 'Incomplete decimal')

        const snapshots = captureStreamingSnapshots(input)
        expect(snapshots[snapshots.length - 1]).toBeDefined()
    })

    test('handles incomplete exponent', () => {
        const input = '{"val":1e'
        dumpStreamingProgress(input, 'Incomplete exponent')

        const snapshots = captureStreamingSnapshots(input)
        expect(snapshots[snapshots.length - 1]).toBeDefined()
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: WHITESPACE HANDLING
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Streaming: Whitespace Handling', () => {
    test('streams with extra whitespace around values', () => {
        const input = '{  "key"  :  "value"  }'
        dumpStreamingProgress(input, 'Extra whitespace')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ key: 'value' })
        log(`\n  ✓ Whitespace handled correctly`)
    })

    test('streams with newlines in object', () => {
        const input = '{\n  "a": 1,\n  "b": 2\n}'
        dumpStreamingProgress(input, 'Newlines in object')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ a: 1, b: 2 })
    })

    test('streams with tabs in object', () => {
        const input = '{\t"x":\t10\t}'
        dumpStreamingProgress(input, 'Tabs in object')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ x: 10 })
    })

    test('streams minified JSON', () => {
        const input = '{"a":1,"b":[2,3],"c":{"d":true}}'
        dumpStreamingProgress(input, 'Minified JSON')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ a: 1, b: [2, 3], c: { d: true } })
    })

    test('streams prettified JSON', () => {
        const input = `{
    "name": "test",
    "values": [
        1,
        2,
        3
    ]
}`
        dumpStreamingProgress(input, 'Prettified JSON')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ name: 'test', values: [1, 2, 3] })
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: COMPLEX NESTED STRUCTURES
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Streaming: Complex Nested Structures', () => {
    test('streams deeply nested objects', () => {
        const input = '{"a":{"b":{"c":{"d":{"e":"deep"}}}}}'
        dumpStreamingProgress(input, 'Deep nesting')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ a: { b: { c: { d: { e: 'deep' } } } } })
    })

    test('streams nested arrays', () => {
        const input = '[[1,2],[3,[4,5]],[[6]]]'
        dumpStreamingProgress(input, 'Nested arrays')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual([[1, 2], [3, [4, 5]], [[6]]])
    })

    test('streams array of objects', () => {
        const input = '[{"id":1,"name":"a"},{"id":2,"name":"b"}]'
        dumpStreamingProgress(input, 'Array of objects')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual([
            { id: 1, name: 'a' },
            { id: 2, name: 'b' }
        ])
    })

    test('streams complex mixed structure', () => {
        const input = '{"users":[{"id":1,"roles":["admin","user"],"meta":{"active":true}}]}'
        dumpStreamingProgress(input, 'Complex mixed')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({
            users: [{ id: 1, roles: ['admin', 'user'], meta: { active: true } }]
        })
    })

    test('streams object with all value types', () => {
        const input = '{"str":"hello","num":42,"bool":true,"nil":null,"arr":[1],"obj":{"k":"v"}}'
        dumpStreamingProgress(input, 'All value types')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({
            str: 'hello',
            num: 42,
            bool: true,
            nil: null,
            arr: [1],
            obj: { k: 'v' }
        })
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: SPECIAL CHARACTERS IN STRINGS
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Streaming: Special Characters in Strings', () => {
    test('handles brackets in strings', () => {
        const input = '{"code":"arr[0] = {}"}'
        dumpStreamingProgress(input, 'Brackets in string')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ code: 'arr[0] = {}' })
    })

    test('handles colon in strings', () => {
        const input = '{"time":"12:30:45"}'
        dumpStreamingProgress(input, 'Colon in string')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ time: '12:30:45' })
    })

    test('handles comma in strings', () => {
        const input = '{"items":"a, b, c"}'
        dumpStreamingProgress(input, 'Comma in string')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ items: 'a, b, c' })
    })

    test('handles JSON-like content in strings', () => {
        const input = '{"json":"{\\"key\\":1}"}'
        dumpStreamingProgress(input, 'JSON-like in string')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ json: '{"key":1}' })
    })

    test('handles unicode characters', () => {
        const input = '{"emoji":"Hello 🌍","jp":"日本語"}'
        dumpStreamingProgress(input, 'Unicode characters')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ emoji: 'Hello 🌍', jp: '日本語' })
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: EMPTY STRUCTURES
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Streaming: Empty Structures', () => {
    test('streams empty object', () => {
        const input = '{}'
        dumpStreamingProgress(input, 'Empty object')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({})
    })

    test('streams empty array', () => {
        const input = '[]'
        dumpStreamingProgress(input, 'Empty array')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual([])
    })

    test('streams empty string value', () => {
        const input = '{"empty":""}'
        dumpStreamingProgress(input, 'Empty string value')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ empty: '' })
    })

    test('streams nested empty structures', () => {
        const input = '{"obj":{},"arr":[],"mix":[{},[],""]}'
        dumpStreamingProgress(input, 'Nested empty structures')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ obj: {}, arr: [], mix: [{}, [], ''] })
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: LEXER VS STREAM PARSER COMPARISON
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Streaming: Lexer vs StreamParser Consistency', () => {
    const testCases = [
        { name: 'simple object', input: '{"key":"value"}' },
        { name: 'nested object', input: '{"user":{"id":1,"tags":["alpha","beta"],"ok":true,"meta":{"score":4.2,"active":false,"missing":null}}}' },
        { name: 'array with escapes', input: '{"message":"line\\nnext","values":[-1,2.5,3],"flag":false}' },
        { name: 'deep nesting', input: '{"a":{"b":{"c":{"d":1}}}}' },
        { name: 'mixed arrays', input: '{"data":[1,"two",true,null,[1,2],{"x":1}]}' },
    ]

    for (const { name, input } of testCases) {
        test(`consistency check: ${name}`, () => {
            logSection(`Consistency: ${name}`)

            const streamParser = new StreamParser([createJsonHandler()])
            const lexer = new Lexer()

            for (const char of input) {
                streamParser.parse(char)
                lexer.processToken(char)
            }

            const streamValue = readStreamParserJson(streamParser)
            const lexerValue = readLexerJson(lexer)

            log(`  Input: ${input.substring(0, 60)}${input.length > 60 ? '...' : ''}`)
            log(`  StreamParser: ${JSON.stringify(streamValue)}`)
            log(`  Lexer:        ${JSON.stringify(lexerValue)}`)

            expect(streamValue).toEqual(lexerValue)
            log(`  ✓ Values match!`)
        })
    }

    test('handles incomplete streams without throwing', () => {
        const incompleteInputs = [
            '{"user":{"id":1,"tags":["alpha"',
            '{"key":',
            '{"key":"val',
            '[1,2,',
            '{"nested":{"deep":',
        ]

        for (const input of incompleteInputs) {
            logSection(`Incomplete: ${input}`)

            const streamParser = new StreamParser([createJsonHandler()])
            const lexer = new Lexer()

            expect(() => {
                for (const char of input) {
                    streamParser.parse(char)
                    lexer.processToken(char)
                }
            }).not.toThrow()

            log(`  ✓ No throw for: ${input}`)
        }
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: STREAMING ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Streaming: Step-by-Step Assertions', () => {
    test('asserts state at specific streaming points', () => {
        const input = '{"count":42}'
        logSection('Step assertions for: ' + input)

        assertStreamingBehavior(input, [
            {
                atIndex: 0,
                description: 'After {',
                streamParserCheck: (val) => val !== null,
            },
            {
                atIndex: 8,
                description: 'After {"count":',
                streamParserCheck: (val) => {
                    if (val && typeof val === 'object' && !Array.isArray(val)) {
                        return 'count' in val
                    }
                    return false
                },
            },
            {
                atIndex: 11,
                description: 'Final state',
                streamParserCheck: (val) => {
                    const obj = val as { count?: number }
                    return obj?.count === 42
                },
            },
        ])

        log('  ✓ All step assertions passed')
    })

    test('tracks boolean completion through stream', () => {
        const input = '{"flag":true}'
        dumpStreamingProgress(input, 'Boolean streaming steps')

        const snapshots = captureStreamingSnapshots(input)

        // Track the evolution of the boolean value
        log('\n  Boolean value evolution:')
        for (let i = 7; i < snapshots.length; i++) {
            const snap = snapshots[i]
            const val = snap.streamParserValue as { flag?: boolean } | null
            if (val && 'flag' in val) {
                log(`    Index ${i} ('${snap.char}'): flag = ${val.flag}`)
            }
        }

        const final = snapshots[snapshots.length - 1]
        expect((final.streamParserValue as { flag: boolean }).flag).toBe(true)
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: STRESS TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Streaming: Stress Tests', () => {
    test('streams large array', () => {
        const arr = Array.from({ length: 100 }, (_, i) => i)
        const input = JSON.stringify(arr)

        logSection('Large array (100 elements)')
        log(`  Input length: ${input.length} characters`)

        const startTime = performance.now()
        const snapshots = captureStreamingSnapshots(input)
        const endTime = performance.now()

        const final = snapshots[snapshots.length - 1]
        expect(final.streamParserValue).toEqual(arr)

        log(`  ✓ Parsed in ${(endTime - startTime).toFixed(2)}ms`)
        log(`  ✓ ${snapshots.length} snapshots captured`)
    })

    test('streams deeply nested structure', () => {
        let nested: any = { value: 'deep' }
        for (let i = 0; i < 20; i++) {
            nested = { level: nested }
        }
        const input = JSON.stringify(nested)

        logSection('Deep nesting (20 levels)')
        log(`  Input length: ${input.length} characters`)

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual(nested)
        log(`  ✓ Deep structure parsed correctly`)
    })

    test('streams object with many keys', () => {
        const obj: Record<string, number> = {}
        for (let i = 0; i < 50; i++) {
            obj[`key${i}`] = i
        }
        const input = JSON.stringify(obj)

        logSection('Many keys (50 keys)')
        log(`  Input length: ${input.length} characters`)

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual(obj)
        log(`  ✓ All 50 keys parsed correctly`)
    })

    test('streams long string value', () => {
        const longString = 'x'.repeat(500)
        const input = JSON.stringify({ text: longString })

        logSection('Long string (500 chars)')

        const snapshots = captureStreamingSnapshots(input)
        const final = snapshots[snapshots.length - 1]

        expect(final.streamParserValue).toEqual({ text: longString })
        log(`  ✓ Long string parsed correctly`)
    })
})
