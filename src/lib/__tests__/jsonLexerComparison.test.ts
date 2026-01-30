import { describe, test, expect } from 'bun:test'
import { StreamParser, type ParsedNode } from '../StreamParser'
import { createJsonHandler } from '../jsonStreamHandler'
import { Lexer } from '../Lexer'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type JsonNode = ParsedNode | string

const readValueNode = (node: JsonNode): JsonValue => {
    if (typeof node === 'string') {
        return node
    }

    if (node.element === 'object') {
        const obj: Record<string, JsonValue> = {}
        for (const child of node.children) {
            if (typeof child === 'string') continue
            if (child.element !== 'pair') continue
            const keyNode = child.children[0]
            const valueNode = child.children[1]
            const key = typeof keyNode === 'string' ? keyNode : String(readValueNode(keyNode))
            if (valueNode) {
                obj[key] = readValueNode(valueNode)
            }
        }
        return obj
    }

    if (node.element === 'array') {
        return node.children
            .filter((child): child is ParsedNode => typeof child !== 'string')
            .map((child) => readValueNode(child))
    }

    if (node.element === 'value') {
        const type = node.attributes?.[0]?.type
        const raw = node.children.join('')
        if (type === 'string') {
            return raw
        }
        if (type === 'null') {
            return null
        }
        if (type === 'primitive') {
            try {
                return JSON.parse(raw) as JsonValue
            } catch {
                return raw
            }
        }
        return raw
    }

    return node.children
        .filter((child): child is ParsedNode => typeof child !== 'string')
        .map((child) => readValueNode(child))
}

const readStreamParserJson = (parser: StreamParser): JsonValue => {
    const jsonNode = parser.root.children.find(
        (child) => typeof child !== 'string' && child.element === 'json'
    ) as ParsedNode | undefined

    if (!jsonNode) {
        throw new Error('Expected json node to be present')
    }

    const rootChild = jsonNode.children.find(
        (child) => typeof child !== 'string'
    ) as ParsedNode | undefined

    if (!rootChild) {
        return {}
    }

    return readValueNode(rootChild)
}

const readLexerJson = (lexer: Lexer): JsonValue => {
    const sections = lexer.getCompletedSections()
    const merged = sections.reduce<Record<string, JsonValue>>((acc, section) => {
        return Object.assign(acc, section)
    }, {})

    return merged
}

const normalizeLexerForStreamValue = (streamValue: JsonValue, lexerValue: JsonValue): JsonValue => {
    if (Array.isArray(streamValue) && lexerValue && typeof lexerValue === 'object' && !Array.isArray(lexerValue)) {
        const arrayValues = Object.values(lexerValue).filter(Array.isArray)
        if (arrayValues.length === 1) {
            return arrayValues[0]
        }
    }

    if (
        streamValue &&
        typeof streamValue === 'object' &&
        !Array.isArray(streamValue) &&
        lexerValue &&
        typeof lexerValue === 'object' &&
        !Array.isArray(lexerValue)
    ) {
        const keys = Object.keys(lexerValue)
        if (keys.length === 1) {
            const soleValue = (lexerValue as Record<string, JsonValue>)[keys[0]]
            if (soleValue && typeof soleValue === 'object' && !Array.isArray(soleValue)) {
                return soleValue
            }
        }
    }

    return lexerValue
}

describe('JSON stream handler vs Lexer', () => {
    test('parses nested object values consistently', () => {
        const input = '{"user":{"id":1,"tags":["alpha","beta"],"ok":true,"meta":{"score":4.2,"active":false,"missing":null}}}'

        const streamParser = new StreamParser([createJsonHandler()])
        for (const char of input) {
            streamParser.parse(char)
        }

        const lexer = new Lexer()
        for (const char of input) {
            lexer.processToken(char)
        }

        const streamValue = readStreamParserJson(streamParser)
        const lexerValue = normalizeLexerForStreamValue(streamValue, readLexerJson(lexer))
        expect(streamValue).toEqual(lexerValue)
    })

    test('parses nested arrays consistently', () => {
        const input = '{"message":"line\\nnext","values":[-1,2.5,3],"flag":false}'

        const streamParser = new StreamParser([createJsonHandler()])
        for (const char of input) {
            streamParser.parse(char)
        }

        const lexer = new Lexer()
        for (const char of input) {
            lexer.processToken(char)
        }

        const streamValue = readStreamParserJson(streamParser)
        const lexerValue = normalizeLexerForStreamValue(streamValue, readLexerJson(lexer))
        expect(streamValue).toEqual(lexerValue)
    })

    test('handles incomplete streams without throwing', () => {
        const input = '{"user":{"id":1,"tags":["alpha"'

        const streamParser = new StreamParser([createJsonHandler()])
        const lexer = new Lexer()

        expect(() => {
            for (const char of input) {
                streamParser.parse(char)
                lexer.processToken(char)
            }
        }).not.toThrow()

        expect(streamParser.root.children.length).toBeGreaterThan(0)
        expect(lexer.getCompletedSections().length).toBeGreaterThan(0)
    })
})
