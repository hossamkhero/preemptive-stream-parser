import { describe, test, expect, beforeEach } from 'bun:test'
import { MarkdownStreamParser, ParsedMDNode } from '../MDStreamParser'

describe('MarkdownStreamParser', () => {
    let parser: MarkdownStreamParser

    beforeEach(() => {
        parser = new MarkdownStreamParser()
    })

    describe('Basic Text', () => {
        test('should parse plain text', () => {
            const result = parser.parse('Hello World')
            expect(result.element).toBe('root')
            expect(result.children).toContain('Hello World')
        })

        test('should handle empty string', () => {
            const result = parser.parse('')
            expect(result.element).toBe('root')
            expect(result.children).toHaveLength(0)
        })

        test('should preserve newlines', () => {
            const result = parser.parse('Line 1\nLine 2')
            expect(result.children).toContain('\n')
        })
    })

    describe('Headers', () => {
        test('should parse h1', () => {
            const result = parser.parse('# Hello')
            const h1 = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'h1'
            ) as ParsedMDNode
            expect(h1).toBeDefined()
            expect(h1.children).toContain('Hello')
        })

        test('should parse h2', () => {
            const result = parser.parse('## World')
            const h2 = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'h2'
            ) as ParsedMDNode
            expect(h2).toBeDefined()
            expect(h2.children).toContain('World')
        })

        test('should parse h3', () => {
            const result = parser.parse('### Subtitle')
            const h3 = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'h3'
            ) as ParsedMDNode
            expect(h3).toBeDefined()
        })

        test('should parse h4', () => {
            const result = parser.parse('#### H4 Text')
            const h4 = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'h4'
            ) as ParsedMDNode
            expect(h4).toBeDefined()
        })

        test('should parse h5', () => {
            const result = parser.parse('##### H5 Text')
            const h5 = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'h5'
            ) as ParsedMDNode
            expect(h5).toBeDefined()
        })

        test('should parse h6', () => {
            const result = parser.parse('###### H6 Text')
            const h6 = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'h6'
            ) as ParsedMDNode
            expect(h6).toBeDefined()
        })
    })

    describe('Bold (Strong)', () => {
        test('should parse bold with asterisks **text**', () => {
            const result = parser.parse('This is **bold** text')
            const strong = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'strong'
            ) as ParsedMDNode
            expect(strong).toBeDefined()
            expect(strong.children.join('')).toContain('bold')
        })

        test('should parse bold with underscores __text__', () => {
            const result = parser.parse('This is __bold__ text')
            const strong = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'strong'
            ) as ParsedMDNode
            expect(strong).toBeDefined()
            expect(strong.children.join('')).toContain('bold')
        })
    })

    describe('Italic (Emphasis)', () => {
        test('should parse italic with asterisk *text*', () => {
            const result = parser.parse('This is *italic* text')
            const em = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'em'
            ) as ParsedMDNode
            expect(em).toBeDefined()
            expect(em.children.join('')).toContain('italic')
        })

        test('should parse italic with underscore _text_', () => {
            const result = parser.parse('This is _italic_ text')
            const em = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'em'
            ) as ParsedMDNode
            expect(em).toBeDefined()
            expect(em.children.join('')).toContain('italic')
        })
    })

    describe('Inline Code', () => {
        test('should parse inline code', () => {
            const result = parser.parse('Use `const` keyword')
            const code = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'code'
            ) as ParsedMDNode
            expect(code).toBeDefined()
            expect(code.children.join('')).toContain('const')
        })
    })

    describe('Links', () => {
        test('should parse links', () => {
            const result = parser.parse('Visit [Example](https://example.com)')
            const link = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'a'
            ) as ParsedMDNode
            expect(link).toBeDefined()
            expect(link.children.join('')).toContain('Example')
            expect(link.attributes[0]).toHaveProperty('href', 'https://example.com')
        })
    })

    describe('Unordered Lists', () => {
        test('should parse unordered list with dash', () => {
            const result = parser.parse('- Item 1')
            const ul = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ul'
            ) as ParsedMDNode
            expect(ul).toBeDefined()

            // ul should contain li elements
            const li = ul.children.find(
                (c) => typeof c !== 'string' && c.element === 'li'
            ) as ParsedMDNode
            expect(li).toBeDefined()
            expect(li.children.join('')).toContain('Item 1')
        })

        test('should parse unordered list with asterisk', () => {
            const result = parser.parse('* Item 1')
            const ul = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ul'
            ) as ParsedMDNode
            expect(ul).toBeDefined()

            const li = ul.children.find(
                (c) => typeof c !== 'string' && c.element === 'li'
            ) as ParsedMDNode
            expect(li).toBeDefined()
        })

        test('should parse unordered list with plus', () => {
            const result = parser.parse('+ Item 1')
            const ul = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ul'
            ) as ParsedMDNode
            expect(ul).toBeDefined()

            const li = ul.children.find(
                (c) => typeof c !== 'string' && c.element === 'li'
            ) as ParsedMDNode
            expect(li).toBeDefined()
        })
    })

    describe('Ordered Lists', () => {
        test('should parse ordered list', () => {
            const result = parser.parse('1. First item')
            const ol = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ol'
            ) as ParsedMDNode
            expect(ol).toBeDefined()

            // ol should contain li elements  
            const li = ol.children.find(
                (c) => typeof c !== 'string' && c.element === 'li'
            ) as ParsedMDNode
            expect(li).toBeDefined()
            expect(li.children.join('')).toContain('First item')
        })
    })

    describe('Multi-item Lists', () => {
        test('should parse multiple unordered list items', () => {
            const result = parser.parse('- Item 1\n- Item 2\n- Item 3')
            const ul = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ul'
            ) as ParsedMDNode
            expect(ul).toBeDefined()

            // Should have 3 li elements
            const lis = ul.children.filter(
                (c) => typeof c !== 'string' && c.element === 'li'
            ) as ParsedMDNode[]
            expect(lis.length).toBe(3)
            expect(lis[0].children.join('')).toContain('Item 1')
            expect(lis[1].children.join('')).toContain('Item 2')
            expect(lis[2].children.join('')).toContain('Item 3')
        })

        test('should parse multiple ordered list items', () => {
            const result = parser.parse('1. First\n2. Second\n3. Third')
            const ol = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ol'
            ) as ParsedMDNode
            expect(ol).toBeDefined()

            const lis = ol.children.filter(
                (c) => typeof c !== 'string' && c.element === 'li'
            ) as ParsedMDNode[]
            expect(lis.length).toBe(3)
            expect(lis[0].children.join('')).toContain('First')
            expect(lis[1].children.join('')).toContain('Second')
            expect(lis[2].children.join('')).toContain('Third')
        })

        test('should keep list type when mixing markers - ul first', () => {
            // When starting with -, subsequent 1. should still be li in ul
            const result = parser.parse('- this is ul\n1. this is also in ul')
            const ul = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ul'
            ) as ParsedMDNode
            expect(ul).toBeDefined()

            // Should NOT have a separate ol
            const ol = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ol'
            )
            expect(ol).toBeUndefined()

            // Both items should be in the ul
            const lis = ul.children.filter(
                (c) => typeof c !== 'string' && c.element === 'li'
            ) as ParsedMDNode[]
            expect(lis.length).toBe(2)
            expect(lis[0].children.join('')).toContain('this is ul')
            expect(lis[1].children.join('')).toContain('this is also in ul')
        })

        test('should keep list type when mixing markers - ol first', () => {
            // When starting with 1., subsequent - should still be li in ol
            const result = parser.parse('1. this is ol\n- this is also in ol')
            const ol = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ol'
            ) as ParsedMDNode
            expect(ol).toBeDefined()

            // Should NOT have a separate ul
            const ul = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ul'
            )
            expect(ul).toBeUndefined()

            // Both items should be in the ol
            const lis = ol.children.filter(
                (c) => typeof c !== 'string' && c.element === 'li'
            ) as ParsedMDNode[]
            expect(lis.length).toBe(2)
            expect(lis[0].children.join('')).toContain('this is ol')
            expect(lis[1].children.join('')).toContain('this is also in ol')
        })

        test('should separate lists with empty line', () => {
            // Empty line between two lists should create separate lists
            const result = parser.parse('- ul item 1\n- ul item 2\n\n1. ol item 1\n2. ol item 2')

            const ul = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ul'
            ) as ParsedMDNode
            expect(ul).toBeDefined()

            const ol = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'ol'
            ) as ParsedMDNode
            expect(ol).toBeDefined()

            // ul should have 2 items
            const ulLis = ul.children.filter(
                (c) => typeof c !== 'string' && c.element === 'li'
            ) as ParsedMDNode[]
            expect(ulLis.length).toBe(2)

            // ol should have 2 items
            const olLis = ol.children.filter(
                (c) => typeof c !== 'string' && c.element === 'li'
            ) as ParsedMDNode[]
            expect(olLis.length).toBe(2)
        })
    })

    describe('Blockquotes', () => {
        test('should parse blockquote', () => {
            const result = parser.parse('> This is a quote')
            const blockquote = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'blockquote'
            ) as ParsedMDNode
            expect(blockquote).toBeDefined()
            expect(blockquote.children.join('')).toContain('This is a quote')
        })
    })

    describe('Streaming (Character-by-Character)', () => {
        test('should produce same result as one-shot parsing', () => {
            const input = '# Hello **World**'

            // One-shot parsing
            const oneShotParser = new MarkdownStreamParser()
            const oneShotResult = oneShotParser.parse(input)

            // Character-by-character streaming
            const streamParser = new MarkdownStreamParser()
            for (const char of input) {
                streamParser.parse(char)
            }
            const streamResult = streamParser.root

            // Compare the results (comparing structure)
            expect(JSON.stringify(streamResult)).toBe(JSON.stringify(oneShotResult))
        })

        test('should handle incremental content correctly', () => {
            const parser1 = new MarkdownStreamParser()
            parser1.parse('Hello ')
            parser1.parse('World')

            expect(parser1.root.children.join('')).toContain('Hello')
            expect(parser1.root.children.join('')).toContain('World')
        })
    })

    describe('Nested Formatting', () => {
        test('should handle bold inside header', () => {
            const result = parser.parse('# Hello **World**')
            const h1 = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'h1'
            ) as ParsedMDNode
            expect(h1).toBeDefined()

            const strong = h1.children.find(
                (c) => typeof c !== 'string' && c.element === 'strong'
            ) as ParsedMDNode
            expect(strong).toBeDefined()
        })

        test('should handle italic inside bold', () => {
            const result = parser.parse('**bold with _italic_ inside**')
            const strong = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'strong'
            ) as ParsedMDNode
            expect(strong).toBeDefined()
        })
    })

    describe('Edge Cases', () => {
        test('should handle unclosed bold', () => {
            const result = parser.parse('This is **unclosed bold')
            expect(result.element).toBe('root')
            // Should not crash
        })

        test('should handle unclosed italic', () => {
            const result = parser.parse('This is *unclosed italic')
            expect(result.element).toBe('root')
            // Should not crash
        })

        test('should handle multiple newlines', () => {
            const result = parser.parse('Line 1\n\n\nLine 2')
            expect(result.element).toBe('root')
        })

        test('should handle special characters', () => {
            const result = parser.parse('Special chars: <>&"\'')
            expect(result.element).toBe('root')
        })
    })

    describe('Inline Element Spacing', () => {
        test('should preserve space before bold with asterisks', () => {
            const result = parser.parse('This is a **bold** word')
            expect(result.children[0]).toBe('This is a ')
            const strong = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'strong'
            ) as ParsedMDNode
            expect(strong).toBeDefined()
            expect(strong.children.join('')).toBe('bold')
            expect(result.children[2]).toBe(' word')
        })

        test('should preserve space before bold with underscores', () => {
            const result = parser.parse('This is a __bold__ word')
            expect(result.children[0]).toBe('This is a ')
            const strong = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'strong'
            ) as ParsedMDNode
            expect(strong).toBeDefined()
            expect(strong.children.join('')).toBe('bold')
        })

        test('should preserve space before italic with asterisk', () => {
            const result = parser.parse('This is a *italic* word')
            expect(result.children[0]).toBe('This is a ')
            const em = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'em'
            ) as ParsedMDNode
            expect(em).toBeDefined()
            expect(em.children.join('')).toBe('italic')
        })

        test('should preserve space before italic with underscore', () => {
            const result = parser.parse('This is a _italic_ word')
            expect(result.children[0]).toBe('This is a ')
            const em = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'em'
            ) as ParsedMDNode
            expect(em).toBeDefined()
            expect(em.children.join('')).toBe('italic')
        })

        test('should preserve space before inline code', () => {
            const result = parser.parse('Use the `const` keyword')
            expect(result.children[0]).toBe('Use the ')
            const code = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'code'
            ) as ParsedMDNode
            expect(code).toBeDefined()
            expect(code.children.join('')).toBe('const')
            expect(result.children[2]).toBe(' keyword')
        })

        test('should preserve space before links', () => {
            const result = parser.parse('Visit [Google](https://google.com) now')
            expect(result.children[0]).toBe('Visit ')
            const link = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'a'
            ) as ParsedMDNode
            expect(link).toBeDefined()
            expect(link.children.join('')).toBe('Google')
            expect(result.children[2]).toBe(' now')
        })

        test('should handle multiple inline elements with proper spacing', () => {
            const result = parser.parse('This is a **bold** statement and _italic_ text.')
            // First part before bold
            expect(result.children[0]).toBe('This is a ')

            // Find bold
            const strong = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'strong'
            ) as ParsedMDNode
            expect(strong).toBeDefined()
            expect(strong.children.join('')).toBe('bold')

            // Find italic
            const em = result.children.find(
                (c) => typeof c !== 'string' && c.element === 'em'
            ) as ParsedMDNode
            expect(em).toBeDefined()
            expect(em.children.join('')).toBe('italic')
        })

        test('should handle inline element at start of text', () => {
            const result = parser.parse('**Bold** at start')
            const strong = result.children[0] as ParsedMDNode
            expect(typeof strong !== 'string').toBe(true)
            expect(strong.element).toBe('strong')
            expect(strong.children.join('')).toBe('Bold')
            expect(result.children[1]).toBe(' at start')
        })

        test('should handle consecutive inline elements', () => {
            const result = parser.parse('**bold** *italic* `code`')
            const elements = result.children.filter(
                (c) => typeof c !== 'string'
            ) as ParsedMDNode[]
            expect(elements).toHaveLength(3)
            expect(elements[0].element).toBe('strong')
            expect(elements[1].element).toBe('em')
            expect(elements[2].element).toBe('code')
        })
    })

    describe('clearAllStates', () => {
        test('should reset parser state', () => {
            parser.parse('# Hello')
            parser.clearAllStates()

            expect(parser.root.children).toHaveLength(0)
            expect(parser.buffer).toBe('')
        })
    })
})
