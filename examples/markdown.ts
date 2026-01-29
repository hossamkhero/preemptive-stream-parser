import {
    createMarkdownParser,
    type HandlerExtension,
    type PatternHandler
} from '../src/lib'

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

const parser = createMarkdownParser([imageExtension])

const input = 'Hello ![Alt text](https://example.com/x.png) **world**.'
parser.parse(input)

console.log(JSON.stringify(parser.root, null, 2))
