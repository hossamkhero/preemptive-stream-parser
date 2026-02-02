import type { ParsedNode, PatternHandler } from './StreamParser'

export const createJsonHandler = (): PatternHandler => {
    const jsonStateMap = new WeakMap<ParsedNode, {
        stack: Array<{
            node: ParsedNode
            type: 'object' | 'array'
            expectingKey?: boolean
            expectingValue?: boolean
            currentPair?: ParsedNode | null
        }>
        currentKey: string | null
        buffer: string
        inString: boolean
        isEscaped: boolean
        stringValueTarget: 'key' | 'value' | null
    }>()
    const pendingStartTokens: Array<'{' | '['> = []

    const buildPrimitiveNode = (raw: string): ParsedNode => {
        const trimmed = raw.trim()

        // Handle boolean prefixes
        const booleanPrefixes = ['t', 'tr', 'tru', 'true', 'f', 'fa', 'fal', 'fals', 'false']
        if (booleanPrefixes.includes(trimmed)) {
            const value = trimmed.startsWith('f') ? 'false' : 'true'
            return {
                element: 'value',
                children: [value],
                attributes: [{ type: 'boolean' }]
            }
        }

        // Handle null prefixes
        if (trimmed === 'n' || trimmed === 'nu' || trimmed === 'nul' || trimmed === 'null') {
            return {
                element: 'value',
                children: ['null'],
                attributes: [{ type: 'null' }]
            }
        }

        // Handle numbers - including partial/incomplete numbers
        // The Lexer treats incomplete numbers as valid numbers with their complete portion

        // Check if it looks like a number (starts with digit, negative sign, or decimal)
        if (/^-?[\d.]/.test(trimmed) || trimmed === '-') {
            let numStr = trimmed

            // Handle lone minus sign - Lexer shows 0
            if (numStr === '-') {
                return {
                    element: 'value',
                    children: ['0'],
                    attributes: [{ type: 'number' }]
                }
            }

            // Handle incomplete decimal (e.g., "3." -> "3")
            // Remove trailing decimal point
            if (numStr.endsWith('.')) {
                numStr = numStr.slice(0, -1)
            }

            // Handle incomplete exponent (e.g., "1e", "1e+", "1e-" -> "1")
            // Remove incomplete exponent notation
            numStr = numStr.replace(/[eE][+-]?$/, '')

            // If after cleanup we have a valid number, use it
            if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(numStr)) {
                return {
                    element: 'value',
                    children: [numStr],
                    attributes: [{ type: 'number' }]
                }
            }

            // If it's just digits (possibly with leading minus), treat as number
            if (/^-?\d+$/.test(numStr)) {
                return {
                    element: 'value',
                    children: [numStr],
                    attributes: [{ type: 'number' }]
                }
            }

            // Fallback for partial numbers - try to extract valid integer portion
            const match = numStr.match(/^-?\d+/)
            if (match) {
                return {
                    element: 'value',
                    children: [match[0]],
                    attributes: [{ type: 'number' }]
                }
            }

            // If nothing valid, default to 0
            return {
                element: 'value',
                children: ['0'],
                attributes: [{ type: 'number' }]
            }
        }

        // Complete number check (should rarely reach here now)
        if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
            return {
                element: 'value',
                children: [trimmed],
                attributes: [{ type: 'number' }]
            }
        }

        return {
            element: 'value',
            children: [trimmed],
            attributes: [{ type: 'primitive' }]
        }
    }

    return {
        name: 'json',
        elementName: 'json',
        allowedNestings: [],
        start: (buffer) => {
            if (buffer.endsWith('{')) {
                pendingStartTokens.push('{')
                return 'commit'
            }
            if (buffer.endsWith('[')) {
                pendingStartTokens.push('[')
                return 'commit'
            }
            return 'no'
        },
        prefixLength: () => 1,
        commit: () => '',
        feed: (char, node) => {
            if (!jsonStateMap.has(node)) {
                const initialToken = pendingStartTokens.shift()
                jsonStateMap.set(node, {
                    stack: [],
                    currentKey: null,
                    buffer: '',
                    inString: false,
                    isEscaped: false,
                    stringValueTarget: null
                })
                const state = jsonStateMap.get(node)!
                if (initialToken === '{') {
                    const obj: ParsedNode = { element: 'object', children: [], attributes: [] }
                    node.children.push(obj)
                    state.stack.push({ node: obj, type: 'object', expectingKey: true, currentPair: null })
                } else if (initialToken === '[') {
                    const arr: ParsedNode = { element: 'array', children: [], attributes: [] }
                    node.children.push(arr)
                    state.stack.push({ node: arr, type: 'array', expectingValue: true, currentPair: null })
                }
                // If this is the trigger character that was already used for initialization,
                // don't process it again as a nested structure
                if (char === initialToken) {
                    return false
                }
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
                const valueNode = buildPrimitiveNode(value)
                if (container.type === 'object' && container.currentPair) {
                    container.currentPair.children[1] = valueNode
                    container.currentPair = null
                    container.expectingKey = true
                } else if (container.type === 'array') {
                    const lastChild = container.node.children[container.node.children.length - 1]
                    if (lastChild && typeof lastChild !== 'string' && lastChild.element === 'value') {
                        lastChild.children = valueNode.children
                        lastChild.attributes = valueNode.attributes
                    } else {
                        container.node.children.push(valueNode)
                    }
                }
                state.buffer = ''
            }

            if (state.inString) {
                if (state.isEscaped) {
                    const escapeMap: Record<string, string> = {
                        n: '\n',
                        t: '\t',
                        r: '\r',
                        b: '\b',
                        f: '\f',
                        '"': '"',
                        '\\': '\\',
                        '/': '/'
                    }
                    state.buffer += escapeMap[char] ?? char
                    state.isEscaped = false
                    // Update the streaming value after escape character
                    const container = currentContainer()
                    if (state.stringValueTarget === 'key' && container?.type === 'object' && container.currentPair) {
                        container.currentPair.children[0] = state.buffer
                    } else if (state.stringValueTarget === 'value' && container) {
                        if (container.type === 'object' && container.currentPair) {
                            const valueNode = container.currentPair.children[1]
                            if (typeof valueNode !== 'string' && valueNode.attributes?.[0]?.type === 'string') {
                                valueNode.children = [state.buffer]
                            }
                        } else if (container.type === 'array') {
                            const lastChild = container.node.children[container.node.children.length - 1]
                            if (typeof lastChild !== 'string' && lastChild.attributes?.[0]?.type === 'string') {
                                lastChild.children = [state.buffer]
                            }
                        }
                    }
                    return false
                }
                if (char === '\\') {
                    state.isEscaped = true
                    return false
                }
                if (char === '"') {
                    // Closing quote - finalize the string
                    state.inString = false
                    const container = currentContainer()
                    if (state.stringValueTarget === 'key' && container?.type === 'object' && container.currentPair) {
                        // Key is already created and updated, just finalize
                        state.currentKey = state.buffer
                        container.expectingKey = false
                        state.buffer = ''
                        state.stringValueTarget = null
                        return false
                    }
                    if (state.stringValueTarget === 'value' && container) {
                        // Value is already created and updated, just finalize
                        if (container.type === 'object' && container.currentPair) {
                            container.currentPair = null
                            container.expectingKey = true
                        }
                        state.buffer = ''
                        state.stringValueTarget = null
                        return false
                    }
                    state.buffer = ''
                    return false
                }
                // Regular character - add to buffer and update streaming value
                state.buffer += char
                const container = currentContainer()
                if (state.stringValueTarget === 'key' && container?.type === 'object' && container.currentPair) {
                    // Update the key progressively
                    container.currentPair.children[0] = state.buffer
                } else if (state.stringValueTarget === 'value' && container) {
                    // Update the string value progressively
                    if (container.type === 'object' && container.currentPair) {
                        const valueNode = container.currentPair.children[1]
                        if (typeof valueNode !== 'string' && valueNode.attributes?.[0]?.type === 'string') {
                            valueNode.children = [state.buffer]
                        }
                    } else if (container.type === 'array') {
                        const lastChild = container.node.children[container.node.children.length - 1]
                        if (typeof lastChild !== 'string' && lastChild.attributes?.[0]?.type === 'string') {
                            lastChild.children = [state.buffer]
                        }
                    }
                }
                return false
            }

            if (char === '"') {
                state.inString = true
                const container = currentContainer()
                if (container?.type === 'object' && container.expectingKey) {
                    // Starting a key string - create the pair immediately with empty key
                    state.stringValueTarget = 'key'
                    const pair: ParsedNode = {
                        element: 'pair',
                        children: [
                            '', // Empty key initially, will be updated as characters come in
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
                } else {
                    // Starting a value string - create the value node immediately
                    state.stringValueTarget = 'value'
                    const valueNode: ParsedNode = {
                        element: 'value',
                        children: [''], // Empty string initially
                        attributes: [{ type: 'string' }]
                    }
                    if (container?.type === 'object' && container.currentPair) {
                        container.currentPair.children[1] = valueNode
                    } else if (container?.type === 'array') {
                        container.node.children.push(valueNode)
                    }
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
                    container.expectingValue = false
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
                    container.expectingValue = false
                }
                state.stack.push({ node: arr, type: 'array', expectingValue: true, currentPair: null })
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
                if (char === ',' && container?.type === 'array') {
                    container.expectingValue = true
                }
                return false
            }

            if (!/\s/.test(char)) {
                state.buffer += char
                const container = currentContainer()
                if (container?.type === 'object' && container.currentPair) {
                    container.currentPair.children[1] = buildPrimitiveNode(state.buffer)
                } else if (container?.type === 'array') {
                    const nextNode = buildPrimitiveNode(state.buffer)
                    if (container.expectingValue) {
                        container.node.children.push(nextNode)
                        container.expectingValue = false
                    } else {
                        const lastChild = container.node.children[container.node.children.length - 1]
                        if (lastChild && typeof lastChild !== 'string' && lastChild.element === 'value') {
                            lastChild.children = nextNode.children
                            lastChild.attributes = nextNode.attributes
                        } else {
                            container.node.children.push(nextNode)
                        }
                    }
                }
            }

            return false
        }
    }
}
