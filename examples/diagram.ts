import { StreamParser, type ParsedNode, type PatternHandler } from '../src/lib'

type DiagramState = {
    phase: 'node' | 'arrow' | 'target'
    buffer: string
    currentEdge: { from: string; to?: string; label?: string } | null
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
            } satisfies DiagramState
        }
        const state = node.attributes[0] as DiagramState

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

const parser = new StreamParser([diagramHandler])
const input = 'graph{A->B;B->C;A-[fast]->C;}'
parser.parse(input)

console.log(JSON.stringify(parser.root, null, 2))
