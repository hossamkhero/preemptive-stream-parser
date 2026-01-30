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
        if (trimmed === 'true' || trimmed === 'false') {
            return {
                element: 'value',
                children: [trimmed],
                attributes: [{ type: 'boolean' }]
            }
        }
        if (trimmed === 'null') {
            return {
                element: 'value',
                children: ['null'],
                attributes: [{ type: 'null' }]
            }
        }
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
