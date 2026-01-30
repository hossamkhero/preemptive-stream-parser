import { describe, test, expect } from 'bun:test'
import { StreamParser, type ParsedNode } from '../StreamParser'
import { createJsonHandler } from '../jsonStreamHandler'

type NodeChild = ParsedNode | string

const getJsonNode = (parser: StreamParser): ParsedNode => {
    const jsonNode = parser.root.children.find(
        (child) => typeof child !== 'string' && child.element === 'json'
    ) as ParsedNode | undefined

    if (!jsonNode) {
        throw new Error('Expected json node to be present')
    }

    const rootChild = jsonNode.children.find((child) => typeof child !== 'string') as ParsedNode | undefined
    if (!rootChild) {
        throw new Error('Expected json node to have a root child')
    }

    return rootChild
}

const findPair = (node: ParsedNode, key: string): ParsedNode => {
    const pair = node.children.find((child): child is ParsedNode => {
        return typeof child !== 'string' && child.element === 'pair' && child.children[0] === key
    })

    if (!pair) {
        throw new Error(`Expected pair for key ${key}`)
    }

    return pair
}

const getValueNode = (pair: ParsedNode): ParsedNode => {
    const valueNode = pair.children[1] as ParsedNode | undefined
    if (!valueNode || typeof valueNode === 'string') {
        throw new Error('Expected value node')
    }
    return valueNode
}

const parseStream = (input: string): ParsedNode => {
    const parser = new StreamParser([createJsonHandler()])
    for (const char of input) {
        parser.parse(char)
    }
    return getJsonNode(parser)
}

describe('json stream handler primitives', () => {
    test('streams booleans/nulls/numbers inside nested objects', () => {
        const root = parseStream('{"user":{"id":1,"tags":["alpha","beta"],"ok":true,"nil":null}}')
        expect(root.element).toBe('object')

        const userPair = findPair(root, 'user')
        const userValue = getValueNode(userPair)
        expect(userValue.element).toBe('object')

        const idValue = getValueNode(findPair(userValue, 'id'))
        expect(idValue.attributes[0]?.type).toBe('number')
        expect(idValue.children.join('')).toBe('1')

        const okValue = getValueNode(findPair(userValue, 'ok'))
        expect(okValue.attributes[0]?.type).toBe('boolean')
        expect(okValue.children.join('')).toBe('true')

        const nilValue = getValueNode(findPair(userValue, 'nil'))
        expect(nilValue.attributes[0]?.type).toBe('null')
        expect(nilValue.children.join('')).toBe('null')

        const tagsValue = getValueNode(findPair(userValue, 'tags'))
        expect(tagsValue.element).toBe('array')
        const tagValues = tagsValue.children.filter((child): child is ParsedNode => typeof child !== 'string')
        expect(tagValues).toHaveLength(2)
        expect(tagValues[0].attributes[0]?.type).toBe('string')
        expect(tagValues[0].children.join('')).toBe('alpha')
        expect(tagValues[1].attributes[0]?.type).toBe('string')
        expect(tagValues[1].children.join('')).toBe('beta')
    })

    test('streams primitives in root arrays with correct types', () => {
        const root = parseStream('[true,false,null,1,2.5,-3e2]')
        expect(root.element).toBe('array')

        const values = root.children.filter((child): child is ParsedNode => typeof child !== 'string')
        expect(values).toHaveLength(6)

        const types = values.map((value) => value.attributes[0]?.type)
        expect(types).toEqual(['boolean', 'boolean', 'null', 'number', 'number', 'number'])
        expect(values[5].children.join('')).toBe('-3e2')
    })

    test('handles whitespace around primitive values', () => {
        const root = parseStream('{"ok":   true,"count":   0}')
        const okValue = getValueNode(findPair(root, 'ok'))
        expect(okValue.attributes[0]?.type).toBe('boolean')
        expect(okValue.children.join('')).toBe('true')

        const countValue = getValueNode(findPair(root, 'count'))
        expect(countValue.attributes[0]?.type).toBe('number')
        expect(countValue.children.join('')).toBe('0')
    })

    test('streams nested arrays of objects with boolean flags', () => {
        const root = parseStream('{"items":[{"id":1,"ok":true},{"id":2,"ok":false}]}')
        const itemsValue = getValueNode(findPair(root, 'items'))
        expect(itemsValue.element).toBe('array')

        const itemNodes = itemsValue.children.filter((child): child is ParsedNode => typeof child !== 'string')
        expect(itemNodes).toHaveLength(2)
        const first = itemNodes[0]
        const second = itemNodes[1]
        expect(first.element).toBe('object')
        expect(second.element).toBe('object')

        const firstOk = getValueNode(findPair(first, 'ok'))
        expect(firstOk.attributes[0]?.type).toBe('boolean')
        expect(firstOk.children.join('')).toBe('true')

        const secondOk = getValueNode(findPair(second, 'ok'))
        expect(secondOk.attributes[0]?.type).toBe('boolean')
        expect(secondOk.children.join('')).toBe('false')
    })
})
