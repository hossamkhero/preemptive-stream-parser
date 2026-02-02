import { describe, test, expect } from 'bun:test'
import { StreamParser, type ParsedNode } from '../StreamParser'
import { createJsonHandler } from '../jsonStreamHandler'

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION & UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

const VERBOSE = true

const log = (...args: unknown[]) => VERBOSE && console.log(...args)

const logSection = (title: string) => {
    if (VERBOSE) {
        console.log('\n' + '─'.repeat(60))
        console.log(`  📝 ${title}`)
        console.log('─'.repeat(60))
    }
}

const logStep = (index: number, char: string, state: string) => {
    if (VERBOSE) {
        const displayChar = char === ' ' ? '␣' : char === '\n' ? '↵' : char === '\t' ? '⇥' : char
        console.log(`    [${index.toString().padStart(3)}] '${displayChar}' → ${state}`)
    }
}



// ══════════════════════════════════════════════════════════════════════════════
// NODE ACCESSORS
// ══════════════════════════════════════════════════════════════════════════════

const getJsonNode = (parser: StreamParser): ParsedNode | null => {
    const jsonNode = parser.root.children.find(
        (child) => typeof child !== 'string' && child.element === 'json'
    ) as ParsedNode | undefined

    if (!jsonNode) return null

    const rootChild = jsonNode.children.find((child) => typeof child !== 'string') as ParsedNode | undefined
    if (!rootChild) return null

    return rootChild
}

const findPair = (node: ParsedNode, key: string): ParsedNode | null => {
    const pair = node.children.find((child): child is ParsedNode => {
        return typeof child !== 'string' && child.element === 'pair' && child.children[0] === key
    })
    return pair ?? null
}

const getValueNode = (pair: ParsedNode): ParsedNode | null => {
    const valueNode = pair.children[1] as ParsedNode | undefined
    if (!valueNode || typeof valueNode === 'string') return null
    return valueNode
}

// ══════════════════════════════════════════════════════════════════════════════
// STREAMING UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

interface StreamState {
    index: number
    char: string
    inputSoFar: string
    rootNode: ParsedNode | null
    nodeTreeDepth: number
    nodeCount: number
}

const streamAndCapture = (input: string): StreamState[] => {
    const states: StreamState[] = []
    const parser = new StreamParser([createJsonHandler()])
    let inputSoFar = ''

    const countNodes = (node: ParsedNode | null): number => {
        if (!node) return 0
        let count = 1
        for (const child of node.children) {
            if (typeof child !== 'string') {
                count += countNodes(child)
            }
        }
        return count
    }

    const getDepth = (node: ParsedNode | null, depth = 0): number => {
        if (!node) return depth
        let maxDepth = depth
        for (const child of node.children) {
            if (typeof child !== 'string') {
                maxDepth = Math.max(maxDepth, getDepth(child, depth + 1))
            }
        }
        return maxDepth
    }

    for (let i = 0; i < input.length; i++) {
        const char = input[i]
        inputSoFar += char
        parser.parse(char)

        const rootNode = getJsonNode(parser)

        states.push({
            index: i,
            char,
            inputSoFar,
            rootNode,
            nodeTreeDepth: getDepth(rootNode),
            nodeCount: countNodes(rootNode),
        })
    }

    return states
}

const dumpStreamProgress = (input: string, title: string) => {
    logSection(title)
    log(`  Input: "${input}"`)
    log(`  Length: ${input.length}\n`)

    const states = streamAndCapture(input)

    for (const state of states) {
        const element = state.rootNode?.element ?? 'none'
        const childCount = state.rootNode?.children.length ?? 0
        logStep(state.index, state.char, `element=${element}, children=${childCount}, depth=${state.nodeTreeDepth}`)
    }

    return states
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: BASIC PRIMITIVE STREAMING
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Stream Handler: Primitive Value Streaming', () => {
    test('streams string value character by character', () => {
        const input = '{"name":"Alice"}'
        const states = dumpStreamProgress(input, 'String Value Streaming')

        const final = states[states.length - 1]
        expect(final.rootNode?.element).toBe('object')

        const pair = findPair(final.rootNode!, 'name')
        expect(pair).not.toBeNull()

        const valueNode = getValueNode(pair!)
        expect(valueNode?.attributes[0]?.type).toBe('string')
        expect(valueNode?.children.join('')).toBe('Alice')

        log('\n  ✓ String streamed correctly: "Alice"')
    })

    test('streams number value digit by digit', () => {
        const input = '{"count":12345}'
        const states = dumpStreamProgress(input, 'Number Value Streaming')

        log('\n  Number progression:')
        for (let i = 9; i < states.length; i++) {
            const state = states[i]
            if (state.rootNode) {
                const pair = findPair(state.rootNode, 'count')
                if (pair) {
                    const val = getValueNode(pair)
                    if (val) {
                        log(`    After '${state.char}': ${val.children.join('')}`)
                    }
                }
            }
        }

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'count')
        const valueNode = getValueNode(pair!)
        expect(valueNode?.attributes[0]?.type).toBe('number')
        expect(valueNode?.children.join('')).toBe('12345')
    })

    test('streams boolean: true', () => {
        const input = '{"ok":true}'
        const states = dumpStreamProgress(input, 'Boolean true Streaming')

        log('\n  Boolean "true" progression:')
        for (let i = 5; i < states.length; i++) {
            const state = states[i]
            if (state.rootNode) {
                const pair = findPair(state.rootNode, 'ok')
                if (pair) {
                    const val = getValueNode(pair)
                    if (val) {
                        log(`    After '${state.char}': type=${val.attributes[0]?.type}, value=${val.children.join('')}`)
                    }
                }
            }
        }

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'ok')
        const valueNode = getValueNode(pair!)
        expect(valueNode?.attributes[0]?.type).toBe('boolean')
        expect(valueNode?.children.join('')).toBe('true')
    })

    test('streams boolean: false', () => {
        const input = '{"ok":false}'
        const states = dumpStreamProgress(input, 'Boolean false Streaming')

        log('\n  Boolean "false" progression:')
        for (let i = 5; i < states.length; i++) {
            const state = states[i]
            if (state.rootNode) {
                const pair = findPair(state.rootNode, 'ok')
                if (pair) {
                    const val = getValueNode(pair)
                    if (val) {
                        log(`    After '${state.char}': type=${val.attributes[0]?.type}, value=${val.children.join('')}`)
                    }
                }
            }
        }

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'ok')
        const valueNode = getValueNode(pair!)
        expect(valueNode?.attributes[0]?.type).toBe('boolean')
        expect(valueNode?.children.join('')).toBe('false')
    })

    test('streams null value', () => {
        const input = '{"val":null}'
        const states = dumpStreamProgress(input, 'Null Value Streaming')

        log('\n  Null progression:')
        for (let i = 6; i < states.length; i++) {
            const state = states[i]
            if (state.rootNode) {
                const pair = findPair(state.rootNode, 'val')
                if (pair) {
                    const val = getValueNode(pair)
                    if (val) {
                        log(`    After '${state.char}': type=${val.attributes[0]?.type}, value=${val.children.join('')}`)
                    }
                }
            }
        }

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'val')
        const valueNode = getValueNode(pair!)
        expect(valueNode?.attributes[0]?.type).toBe('null')
        expect(valueNode?.children.join('')).toBe('null')
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: PARTIAL PRIMITIVE STREAMING
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Stream Handler: Partial Primitive Detection', () => {
    test('detects partial "true" at each prefix', () => {
        const prefixes = ['t', 'tr', 'tru', 'true']

        for (const prefix of prefixes) {
            const input = `{"ok":${prefix}`
            logSection(`Partial true: "${prefix}"`)

            const states = streamAndCapture(input)
            const final = states[states.length - 1]

            if (final.rootNode) {
                const pair = findPair(final.rootNode, 'ok')
                if (pair) {
                    const val = getValueNode(pair)
                    log(`    type: ${val?.attributes[0]?.type}`)
                    log(`    value: ${val?.children.join('')}`)

                    expect(val?.attributes[0]?.type).toBe('boolean')
                    expect(val?.children.join('')).toBe('true')
                }
            }
        }

        log('\n  ✓ All "true" prefixes detected as boolean')
    })

    test('detects partial "false" at each prefix', () => {
        const prefixes = ['f', 'fa', 'fal', 'fals', 'false']

        for (const prefix of prefixes) {
            const input = `{"ok":${prefix}`
            logSection(`Partial false: "${prefix}"`)

            const states = streamAndCapture(input)
            const final = states[states.length - 1]

            if (final.rootNode) {
                const pair = findPair(final.rootNode, 'ok')
                if (pair) {
                    const val = getValueNode(pair)
                    log(`    type: ${val?.attributes[0]?.type}`)
                    log(`    value: ${val?.children.join('')}`)

                    expect(val?.attributes[0]?.type).toBe('boolean')
                    expect(val?.children.join('')).toBe('false')
                }
            }
        }

        log('\n  ✓ All "false" prefixes detected as boolean')
    })

    test('detects partial "null" at each prefix', () => {
        const prefixes = ['n', 'nu', 'nul', 'null']

        for (const prefix of prefixes) {
            const input = `{"val":${prefix}`
            logSection(`Partial null: "${prefix}"`)

            const states = streamAndCapture(input)
            const final = states[states.length - 1]

            if (final.rootNode) {
                const pair = findPair(final.rootNode, 'val')
                if (pair) {
                    const val = getValueNode(pair)
                    log(`    type: ${val?.attributes[0]?.type}`)
                    log(`    value: ${val?.children.join('')}`)

                    expect(val?.attributes[0]?.type).toBe('null')
                    expect(val?.children.join('')).toBe('null')
                }
            }
        }

        log('\n  ✓ All "null" prefixes detected as null')
    })

    test('detects partial numbers progressively', () => {
        const testCases = [
            { input: '{"n":1', expected: '1' },
            { input: '{"n":12', expected: '12' },
            { input: '{"n":123', expected: '123' },
            { input: '{"n":-', expected: '-' },
            { input: '{"n":-1', expected: '-1' },
            { input: '{"n":3.', expected: '3.' },
            { input: '{"n":3.1', expected: '3.1' },
            { input: '{"n":1e', expected: '1e' },
            { input: '{"n":1e5', expected: '1e5' },
        ]

        for (const { input, expected } of testCases) {
            logSection(`Partial number: "${expected}"`)

            const states = streamAndCapture(input)
            const final = states[states.length - 1]

            if (final.rootNode) {
                const pair = findPair(final.rootNode, 'n')
                if (pair) {
                    const val = getValueNode(pair)
                    log(`    children: ${val?.children.join('')}`)
                    log(`    type: ${val?.attributes[0]?.type}`)
                }
            }
        }
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: NESTED STRUCTURE STREAMING
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Stream Handler: Nested Structures', () => {
    test('streams nested object progressively', () => {
        const input = '{"user":{"id":1,"name":"Bob"}}'
        const states = dumpStreamProgress(input, 'Nested Object Streaming')

        log('\n  Tree depth progression:')
        for (const state of states) {
            log(`    Index ${state.index}: depth=${state.nodeTreeDepth}, nodes=${state.nodeCount}`)
        }

        const final = states[states.length - 1]
        expect(final.rootNode?.element).toBe('object')

        const userPair = findPair(final.rootNode!, 'user')
        expect(userPair).not.toBeNull()

        const userValue = getValueNode(userPair!)
        expect(userValue?.element).toBe('object')

        const idPair = findPair(userValue!, 'id')
        const idValue = getValueNode(idPair!)
        expect(idValue?.children.join('')).toBe('1')

        const namePair = findPair(userValue!, 'name')
        const nameValue = getValueNode(namePair!)
        expect(nameValue?.children.join('')).toBe('Bob')
    })

    test('streams array of primitives progressively', () => {
        const input = '[1,2,3,4,5]'
        const states = dumpStreamProgress(input, 'Array of Primitives')

        log('\n  Array children progression:')
        for (const state of states) {
            if (state.rootNode?.element === 'array') {
                const valueCount = state.rootNode.children.filter(
                    (c): c is ParsedNode => typeof c !== 'string'
                ).length
                log(`    Index ${state.index} ('${state.char}'): ${valueCount} values`)
            }
        }

        const final = states[states.length - 1]
        expect(final.rootNode?.element).toBe('array')

        const values = final.rootNode!.children.filter(
            (c): c is ParsedNode => typeof c !== 'string'
        )
        expect(values).toHaveLength(5)
    })

    test('streams array of objects progressively', () => {
        const input = '[{"a":1},{"b":2}]'
        const states = dumpStreamProgress(input, 'Array of Objects')

        log('\n  Object count in array:')
        for (const state of states) {
            if (state.rootNode?.element === 'array') {
                const objectCount = state.rootNode.children.filter(
                    (c): c is ParsedNode => typeof c !== 'string' && c.element === 'object'
                ).length
                log(`    Index ${state.index} ('${state.char}'): ${objectCount} objects`)
            }
        }

        const final = states[states.length - 1]
        const objects = final.rootNode!.children.filter(
            (c): c is ParsedNode => typeof c !== 'string' && c.element === 'object'
        )
        expect(objects).toHaveLength(2)
    })

    test('streams deeply nested structure', () => {
        const input = '{"a":{"b":{"c":{"d":"deep"}}}}'
        const states = dumpStreamProgress(input, 'Deep Nesting')

        log('\n  Depth progression:')
        let maxDepth = 0
        for (const state of states) {
            if (state.nodeTreeDepth > maxDepth) {
                maxDepth = state.nodeTreeDepth
                log(`    Index ${state.index} ('${state.char}'): new max depth = ${maxDepth}`)
            }
        }

        const final = states[states.length - 1]
        expect(final.nodeTreeDepth).toBeGreaterThanOrEqual(4)
        log(`\n  ✓ Max depth reached: ${final.nodeTreeDepth}`)
    })

    test('streams mixed nested arrays and objects', () => {
        const input = '{"data":[[1,2],{"x":[3,4]}]}'
        const states = dumpStreamProgress(input, 'Mixed Nesting')

        const final = states[states.length - 1]
        expect(final.rootNode?.element).toBe('object')
        log(`\n  ✓ Complex mixed structure parsed`)
        log(`    Final node count: ${final.nodeCount}`)
        log(`    Final depth: ${final.nodeTreeDepth}`)
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: ESCAPE SEQUENCE STREAMING
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Stream Handler: Escape Sequences', () => {
    test('streams escaped newline', () => {
        const input = '{"text":"line1\\nline2"}'
        const states = dumpStreamProgress(input, 'Escaped Newline')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'text')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('line1\nline2')
        log(`\n  ✓ Escaped newline: "${value?.children.join('')}"`)
    })

    test('streams escaped tab', () => {
        const input = '{"text":"a\\tb"}'
        const states = dumpStreamProgress(input, 'Escaped Tab')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'text')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('a\tb')
    })

    test('streams escaped quote', () => {
        const input = '{"text":"say \\"hi\\""}'
        const states = dumpStreamProgress(input, 'Escaped Quote')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'text')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('say "hi"')
    })

    test('streams escaped backslash', () => {
        const input = '{"path":"C:\\\\dir"}'
        const states = dumpStreamProgress(input, 'Escaped Backslash')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'path')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('C:\\dir')
    })

    test('streams multiple escapes in sequence', () => {
        const input = '{"esc":"\\t\\n\\r\\\\"}'
        const states = dumpStreamProgress(input, 'Multiple Escapes')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'esc')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('\t\n\r\\')
    })

    test('streams escaped forward slash', () => {
        const input = '{"url":"http:\\/\\/test.com"}'
        const states = dumpStreamProgress(input, 'Escaped Forward Slash')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'url')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('http://test.com')
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: NUMERIC EDGE CASES
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Stream Handler: Numeric Edge Cases', () => {
    test('streams negative integer', () => {
        const input = '{"val":-42}'
        const states = dumpStreamProgress(input, 'Negative Integer')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'val')
        const value = getValueNode(pair!)

        expect(value?.attributes[0]?.type).toBe('number')
        expect(value?.children.join('')).toBe('-42')
    })

    test('streams decimal number', () => {
        const input = '{"val":3.14}'
        const states = dumpStreamProgress(input, 'Decimal Number')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'val')
        const value = getValueNode(pair!)

        expect(value?.attributes[0]?.type).toBe('number')
        expect(value?.children.join('')).toBe('3.14')
    })

    test('streams scientific notation (positive exp)', () => {
        const input = '{"val":1e10}'
        const states = dumpStreamProgress(input, 'Scientific Notation +')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'val')
        const value = getValueNode(pair!)

        expect(value?.attributes[0]?.type).toBe('number')
        expect(value?.children.join('')).toBe('1e10')
    })

    test('streams scientific notation (negative exp)', () => {
        const input = '{"val":5e-3}'
        const states = dumpStreamProgress(input, 'Scientific Notation -')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'val')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('5e-3')
    })

    test('streams zero', () => {
        const input = '{"val":0}'
        const states = dumpStreamProgress(input, 'Zero')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'val')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('0')
    })

    test('streams negative zero', () => {
        const input = '{"val":-0}'
        const states = dumpStreamProgress(input, 'Negative Zero')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'val')
        const value = getValueNode(pair!)

        // Should parse as -0
        expect(value?.children.join('')).toBe('-0')
    })

    test('streams array of mixed numbers', () => {
        const input = '[0,-1,2.5,3e2,-4.5e-1]'
        const states = dumpStreamProgress(input, 'Mixed Number Array')

        const final = states[states.length - 1]
        const values = final.rootNode!.children.filter(
            (c): c is ParsedNode => typeof c !== 'string'
        )

        expect(values).toHaveLength(5)

        const numbers = values.map(v => v.children.join(''))
        log(`\n  Parsed numbers: ${JSON.stringify(numbers)}`)
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: WHITESPACE HANDLING
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Stream Handler: Whitespace', () => {
    test('handles extra spaces around colon', () => {
        const input = '{"key" : "value"}'
        const states = dumpStreamProgress(input, 'Spaces Around Colon')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'key')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('value')
    })

    test('handles extra spaces around comma', () => {
        const input = '{"a": 1 , "b": 2}'
        const states = dumpStreamProgress(input, 'Spaces Around Comma')

        const final = states[states.length - 1]
        expect(findPair(final.rootNode!, 'a')).not.toBeNull()
        expect(findPair(final.rootNode!, 'b')).not.toBeNull()
    })

    test('handles newlines in objects', () => {
        const input = '{\n"a": 1\n}'
        const states = dumpStreamProgress(input, 'Newlines in Object')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'a')
        expect(pair).not.toBeNull()
    })

    test('handles tabs in arrays', () => {
        const input = '[\t1,\t2\t]'
        const states = dumpStreamProgress(input, 'Tabs in Array')

        const final = states[states.length - 1]
        const values = final.rootNode!.children.filter(
            (c): c is ParsedNode => typeof c !== 'string'
        )
        expect(values).toHaveLength(2)
    })

    test('handles mixed whitespace', () => {
        const input = '{ \n\t"key" \t:\n "val" \n}'
        const states = dumpStreamProgress(input, 'Mixed Whitespace')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'key')
        expect(pair).not.toBeNull()
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: EMPTY STRUCTURES
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Stream Handler: Empty Structures', () => {
    test('streams empty object', () => {
        const input = '{}'
        const states = dumpStreamProgress(input, 'Empty Object')

        const final = states[states.length - 1]
        expect(final.rootNode?.element).toBe('object')
        expect(final.rootNode?.children.filter(c => typeof c !== 'string')).toHaveLength(0)
    })

    test('streams empty array', () => {
        const input = '[]'
        const states = dumpStreamProgress(input, 'Empty Array')

        const final = states[states.length - 1]
        expect(final.rootNode?.element).toBe('array')
        expect(final.rootNode?.children.filter(c => typeof c !== 'string')).toHaveLength(0)
    })

    test('streams empty string value', () => {
        const input = '{"key":""}'
        const states = dumpStreamProgress(input, 'Empty String Value')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'key')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('')
        expect(value?.attributes[0]?.type).toBe('string')
    })

    test('streams nested empty structures', () => {
        const input = '{"obj":{},"arr":[]}'
        const states = dumpStreamProgress(input, 'Nested Empty Structures')

        const final = states[states.length - 1]

        const objPair = findPair(final.rootNode!, 'obj')
        const objValue = getValueNode(objPair!)
        expect(objValue?.element).toBe('object')

        const arrPair = findPair(final.rootNode!, 'arr')
        const arrValue = getValueNode(arrPair!)
        expect(arrValue?.element).toBe('array')
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: SPECIAL CHARACTERS IN STRINGS
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Stream Handler: Special Characters in Strings', () => {
    test('handles brackets in string values', () => {
        const input = '{"code":"arr[0] = {}"}'
        const states = dumpStreamProgress(input, 'Brackets in String')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'code')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('arr[0] = {}')
    })

    test('handles colon in string values', () => {
        const input = '{"time":"12:30:45"}'
        const states = dumpStreamProgress(input, 'Colon in String')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'time')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('12:30:45')
    })

    test('handles comma in string values', () => {
        const input = '{"list":"a, b, c"}'
        const states = dumpStreamProgress(input, 'Comma in String')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'list')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('a, b, c')
    })

    test('handles JSON-like content in strings', () => {
        const input = '{"json":"{\\"k\\":1}"}'
        const states = dumpStreamProgress(input, 'JSON-like in String')

        const final = states[states.length - 1]
        const pair = findPair(final.rootNode!, 'json')
        const value = getValueNode(pair!)

        expect(value?.children.join('')).toBe('{"k":1}')
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: COMPLEX COMPREHENSIVE TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Stream Handler: Comprehensive Tests', () => {
    test('streams complex nested structure from original test', () => {
        const input = '{"user":{"id":1,"tags":["alpha","beta"],"ok":true,"nil":null}}'
        const states = dumpStreamProgress(input, 'Complex Nested Structure')

        const final = states[states.length - 1]
        expect(final.rootNode?.element).toBe('object')

        const userPair = findPair(final.rootNode!, 'user')
        const userValue = getValueNode(userPair!)
        expect(userValue?.element).toBe('object')

        const idValue = getValueNode(findPair(userValue!, 'id')!)
        expect(idValue?.attributes[0]?.type).toBe('number')
        expect(idValue?.children.join('')).toBe('1')

        const okValue = getValueNode(findPair(userValue!, 'ok')!)
        expect(okValue?.attributes[0]?.type).toBe('boolean')
        expect(okValue?.children.join('')).toBe('true')

        const nilValue = getValueNode(findPair(userValue!, 'nil')!)
        expect(nilValue?.attributes[0]?.type).toBe('null')
        expect(nilValue?.children.join('')).toBe('null')

        const tagsValue = getValueNode(findPair(userValue!, 'tags')!)
        expect(tagsValue?.element).toBe('array')

        const tagValues = tagsValue!.children.filter(
            (child): child is ParsedNode => typeof child !== 'string'
        )
        expect(tagValues).toHaveLength(2)
        expect(tagValues[0].attributes[0]?.type).toBe('string')
        expect(tagValues[0].children.join('')).toBe('alpha')
        expect(tagValues[1].children.join('')).toBe('beta')

        log('\n  ✓ All nested values verified')
    })

    test('streams primitives in root arrays', () => {
        const input = '[true,false,null,1,2.5,-3e2]'
        const states = dumpStreamProgress(input, 'Primitives in Root Array')

        const final = states[states.length - 1]
        expect(final.rootNode?.element).toBe('array')

        const values = final.rootNode!.children.filter(
            (child): child is ParsedNode => typeof child !== 'string'
        )
        expect(values).toHaveLength(6)

        const types = values.map((value) => value.attributes[0]?.type)
        expect(types).toEqual(['boolean', 'boolean', 'null', 'number', 'number', 'number'])

        log(`\n  Types: ${JSON.stringify(types)}`)
    })

    test('streams nested arrays of objects with boolean flags', () => {
        const input = '{"items":[{"id":1,"ok":true},{"id":2,"ok":false}]}'
        const states = dumpStreamProgress(input, 'Nested Array of Objects')

        const final = states[states.length - 1]
        const itemsValue = getValueNode(findPair(final.rootNode!, 'items')!)
        expect(itemsValue?.element).toBe('array')

        const itemNodes = itemsValue!.children.filter(
            (child): child is ParsedNode => typeof child !== 'string'
        )
        expect(itemNodes).toHaveLength(2)

        const first = itemNodes[0]
        const second = itemNodes[1]
        expect(first.element).toBe('object')
        expect(second.element).toBe('object')

        const firstOk = getValueNode(findPair(first, 'ok')!)
        expect(firstOk?.attributes[0]?.type).toBe('boolean')
        expect(firstOk?.children.join('')).toBe('true')

        const secondOk = getValueNode(findPair(second, 'ok')!)
        expect(secondOk?.attributes[0]?.type).toBe('boolean')
        expect(secondOk?.children.join('')).toBe('false')

        log('\n  ✓ Nested array of objects with booleans verified')
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: STRESS TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON Stream Handler: Stress Tests', () => {
    test('streams large array', () => {
        const arr = Array.from({ length: 50 }, (_, i) => i)
        const input = JSON.stringify(arr)

        logSection('Large Array (50 elements)')
        log(`  Input length: ${input.length} chars`)

        const startTime = performance.now()
        const states = streamAndCapture(input)
        const endTime = performance.now()

        const final = states[states.length - 1]
        const values = final.rootNode!.children.filter(
            (c): c is ParsedNode => typeof c !== 'string'
        )

        expect(values).toHaveLength(50)
        log(`  ✓ Parsed in ${(endTime - startTime).toFixed(2)}ms`)
    })

    test('streams object with many keys', () => {
        const obj: Record<string, number> = {}
        for (let i = 0; i < 30; i++) {
            obj[`key${i}`] = i
        }
        const input = JSON.stringify(obj)

        logSection('Many Keys (30 keys)')
        log(`  Input length: ${input.length} chars`)

        const startTime = performance.now()
        const states = streamAndCapture(input)
        const endTime = performance.now()

        const final = states[states.length - 1]
        const pairs = final.rootNode!.children.filter(
            (c): c is ParsedNode => typeof c !== 'string' && c.element === 'pair'
        )

        expect(pairs).toHaveLength(30)
        log(`  ✓ Parsed in ${(endTime - startTime).toFixed(2)}ms`)
    })

    test('streams deeply nested structure', () => {
        let nested: any = { value: 'deep' }
        for (let i = 0; i < 15; i++) {
            nested = { level: nested }
        }
        const input = JSON.stringify(nested)

        logSection('Deep Nesting (15 levels)')
        log(`  Input length: ${input.length} chars`)

        const states = streamAndCapture(input)
        const final = states[states.length - 1]

        expect(final.nodeTreeDepth).toBeGreaterThanOrEqual(15)
        log(`  ✓ Final depth: ${final.nodeTreeDepth}`)
    })
})
