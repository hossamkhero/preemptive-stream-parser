import { describe, test, expect, beforeEach } from 'bun:test'
import { StreamParser, type ParsedNode, type PatternHandler } from '../StreamParser'
import { composeHandlers, createMarkdownParser } from '../extensions'

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

describe('Handler extensions', () => {
    test('should insert handlers before a named anchor', () => {
        const a: PatternHandler = {
            name: 'a',
            elementName: 'a',
            start: () => 'no'
        }
        const b: PatternHandler = {
            name: 'b',
            elementName: 'b',
            start: () => 'no'
        }
        const c: PatternHandler = {
            name: 'c',
            elementName: 'c',
            start: () => 'no'
        }
        const extra: PatternHandler = {
            name: 'extra',
            elementName: 'extra',
            start: () => 'no'
        }

        const ordered = composeHandlers([a, b, c], [
            {
                name: 'extra',
                handlers: [extra],
                placement: { before: 'b' }
            }
        ])

        expect(ordered.map((handler) => handler.name)).toEqual(['a', 'extra', 'b', 'c'])
    })

    test('should replace existing handlers when requested', () => {
        const a: PatternHandler = {
            name: 'a',
            elementName: 'a',
            start: () => 'no'
        }
        const replacement: PatternHandler = {
            name: 'a',
            elementName: 'a',
            start: () => 'no'
        }

        const ordered = composeHandlers([a], [
            {
                name: 'replacement',
                handlers: [replacement],
                replaceExisting: true
            }
        ])

        expect(ordered).toHaveLength(1)
        expect(ordered[0]).toBe(replacement)
    })

    test('should allow Markdown extension handlers', () => {
        const tagHandler: PatternHandler = {
            name: 'tag',
            elementName: 'tag',
            allowedNestings: [],
            start: (buffer) => {
                if (buffer.endsWith('@@')) return 'commit'
                if (buffer.endsWith('@')) return 'potential'
                return 'no'
            },
            prefixLength: () => 2,
            commit: () => '',
            feed: (char, node, streamParser) => {
                if (char === '@') return true
                streamParser.addTextToNode(node, char)
                return false
            }
        }

        const parser = createMarkdownParser([
            {
                name: 'tags',
                handlers: [tagHandler],
                placement: { before: 'code' }
            }
        ])

        const result = parser.parse('Hello @@world@')
        const tag = result.children.find(
            (c) => typeof c !== 'string' && c.element === 'tag'
        ) as ParsedNode
        expect(tag).toBeDefined()
        expect(tag.children.join('')).toBe('world')
    })
})
