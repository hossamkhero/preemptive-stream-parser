import { beforeEach, describe, expect, test } from 'bun:test'
import { StreamParser, type ParsedNode, type PatternHandler } from '../index'

describe('StreamParser (generic)', () => {
    let parser: StreamParser

    const shoutHandler: PatternHandler<{}, undefined> = {
        elementName: 'shout',
        allowedNestings: [],
        start: (buffer) => {
            const opener = '!!'
            if (opener.startsWith(buffer)) {
                if (buffer === opener) {
                    return { kind: 'commit', seed: undefined, consumed: opener.length }
                }
                return { kind: 'potential' }
            }
            return { kind: 'no' }
        },
        createState: () => ({}),
        step: ({ char, writer }) => {
            if (char === '!') return true
            writer.text(char)
            return false
        }
    }

    beforeEach(() => {
        parser = new StreamParser([shoutHandler])
    })

    test('should parse a custom handler in one-shot mode', () => {
        const result = parser.parse('hello!!world!')
        const shout = result.children.find(
            (child) => typeof child !== 'string' && child.element === 'shout'
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
            (child) => typeof child !== 'string' && child.element === 'shout'
        ) as ParsedNode
        expect(shout).toBeDefined()
        expect(shout.children.join('')).toBe('wow')
    })

    test('should preserve text outside custom nodes', () => {
        const result = parser.parse('a!!b!c')
        expect(result.children[0]).toBe('a')

        const shout = result.children.find(
            (child) => typeof child !== 'string' && child.element === 'shout'
        ) as ParsedNode
        expect(shout).toBeDefined()
        expect(shout.children.join('')).toBe('b')
        expect(result.children[result.children.length - 1]).toBe('c')
    })
})
