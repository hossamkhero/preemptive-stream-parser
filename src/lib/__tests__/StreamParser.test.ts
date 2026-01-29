import { describe, test, expect, beforeEach } from 'bun:test'
import { StreamParser, type ParsedNode, type PatternHandler } from '../StreamParser'

describe('StreamParser (generic)', () => {
    let parser: StreamParser

    const shoutHandler: PatternHandler = {
        name: 'shout',
        elementName: 'shout',
        allowedNestings: [],
        start: (buffer) => {
            if (buffer.endsWith('!!')) return 'commit'
            if (buffer.endsWith('!')) return 'potential'
            return 'no'
        },
        prefixLength: () => 2,
        commit: () => '',
        feed: (char, node, streamParser) => {
            if (char === '!') return true
            streamParser.addTextToNode(node, char)
            return false
        }
    }

    beforeEach(() => {
        parser = new StreamParser([shoutHandler])
    })

    test('should parse a custom handler in one-shot mode', () => {
        const result = parser.parse('hello!!world!')
        const shout = result.children.find(
            (c) => typeof c !== 'string' && c.element === 'shout'
        ) as ParsedNode
        expect(shout).toBeDefined()
        expect(shout.children.join('')).toBe('world')
    })

    test('should parse a custom handler in streaming mode', () => {
        const streamParser = new StreamParser([shoutHandler])
        const input = 'hello!!wow!'
        for (const char of input) {
            streamParser.parse(char)
        }
        const shout = streamParser.root.children.find(
            (c) => typeof c !== 'string' && c.element === 'shout'
        ) as ParsedNode
        expect(shout).toBeDefined()
        expect(shout.children.join('')).toBe('wow')
    })

    test('should preserve text outside custom nodes', () => {
        const result = parser.parse('a!!b!c')
        expect(result.children[0]).toBe('a')
        const shout = result.children.find(
            (c) => typeof c !== 'string' && c.element === 'shout'
        ) as ParsedNode
        expect(shout.children.join('')).toBe('b')
        expect(result.children[result.children.length - 1]).toBe('c')
    })
})
