import { StreamParser, type ParsedNode, type PatternHandler } from '../src/lib'

type JsonState = {
    stack: ParsedNode[]
    currentKey: string | null
    buffer: string
    inString: boolean
    isEscaped: boolean
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
    feed: (char, node, parser) => {
        if (!node.attributes[0]) {
            node.attributes[0] = {
                stack: [node],
                currentKey: null,
                buffer: '',
                inString: false,
                isEscaped: false
            } satisfies JsonState
        }
        const state = node.attributes[0] as JsonState

        const flushBuffer = () => {
            const value = state.buffer.trim()
            if (!value) return
            const current = state.stack[state.stack.length - 1]
            if (current.element === 'object') {
                if (state.currentKey !== null) {
                    current.children.push({
                        element: 'pair',
                        children: [state.currentKey, value],
                        attributes: []
                    })
                    state.currentKey = null
                }
            } else if (current.element === 'array') {
                current.children.push(value)
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
                const current = state.stack[state.stack.length - 1]
                if (current.element === 'object' && state.currentKey === null) {
                    state.currentKey = state.buffer
                    state.buffer = ''
                }
                return false
            }
            state.buffer += char
            return false
        }

        if (char === '"') {
            state.inString = true
            return false
        }

        if (char === '{') {
            flushBuffer()
            const obj: ParsedNode = { element: 'object', children: [], attributes: [] }
            const current = state.stack[state.stack.length - 1]
            current.children.push(obj)
            state.stack.push(obj)
            return false
        }

        if (char === '[') {
            flushBuffer()
            const arr: ParsedNode = { element: 'array', children: [], attributes: [] }
            const current = state.stack[state.stack.length - 1]
            current.children.push(arr)
            state.stack.push(arr)
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
            return false
        }

        if (!/\s/.test(char)) {
            state.buffer += char
        }

        return false
    }
}

const parser = new StreamParser([jsonHandler])
const input = '{"user":{"id":1,"tags":["alpha","beta"],"ok":true}}'
parser.parse(input)

console.log(JSON.stringify(parser.root, null, 2))
