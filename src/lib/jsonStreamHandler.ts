import type { ParsedNode, PatternHandler } from './StreamParser'

export const createJsonHandler = (): PatternHandler => {
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

    return {
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
}
