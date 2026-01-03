import type { PatternHandler, ParsedMDNode, MarkdownStreamParser } from './MDStreamParser';

// Helper function to check if we're at start of line
function isAtStartOfLine(parser: MarkdownStreamParser): boolean {
    const current = parser.getCurrentNode();
    if (current.children.length === 0) return true;

    const lastChild = current.children[current.children.length - 1];
    if (typeof lastChild === 'string') {
        return lastChild === '\n';
    }

    // If it's a node, check if it ends with newline
    return nodeEndsWithNewline(lastChild as ParsedMDNode);
}

function nodeEndsWithNewline(node: ParsedMDNode): boolean {
    if (node.children.length === 0) return false;
    const lastChild = node.children[node.children.length - 1];
    if (typeof lastChild === 'string') {
        return lastChild === '\n';
    }
    return nodeEndsWithNewline(lastChild as ParsedMDNode);
}

// Helper function to create header handlers
function createHeaderHandler(level: number): PatternHandler {
    const prefix = '#'.repeat(level);
    const elementName = `h${level}`;

    return {
        name: elementName,
        elementName: elementName,
        reuseTerminator: true,
        // Allow only inline patterns inside headers
        allowedNestings: [
            'strong_asterisk',
            'strong_underscore',
            'em_asterisk',
            'em_underscore',
            'code',
            'a'
        ],

        start(buffer: string, parser?: MarkdownStreamParser): "no" | "potential" | "commit" {
            if (buffer === prefix) return "potential";
            if (buffer === `${prefix} `) {
                if (parser && !isAtStartOfLine(parser)) return "no";
                return "commit";
            }
            if (buffer.startsWith(`${prefix} `)) {
                if (parser && !isAtStartOfLine(parser)) return "no";
                return "commit";
            }
            return "no";
        },

        feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
            if (char === "\n") {
                return true; // Done with header
            }
            // Append char to node's children
            const lastChild = node.children[node.children.length - 1];
            if (typeof lastChild === "string") {
                node.children[node.children.length - 1] = lastChild + char;
            } else {
                node.children.push(char);
            }
            return false;
        },

        upgrade(node: ParsedMDNode, buffer: string, parser: MarkdownStreamParser): void {
            // Already handled inline, nothing to strip since we started feeding after "# "
        }
    };
}

// Create all header handlers
const headerHandlers = Array.from({ length: 6 }, (_, i) => createHeaderHandler(i + 1));

// Bold handler (using **)
const boldHandler: PatternHandler = {
    name: "strong_asterisk",
    elementName: "strong",
    // Allow only inline patterns inside bold
    allowedNestings: [
        'strong_asterisk',
        'strong_underscore',
        'em_asterisk',
        'em_underscore',
        'code',
        'a'
    ],

    start(buffer: string): "no" | "potential" | "commit" {
        if (buffer.endsWith("*")) return "potential";
        // Check if buffer ends with ** followed by a non-* and non-whitespace character
        if (buffer.match(/\*\*[^*\s]$/)) return "commit";
        return "no";
    },

    commit(buffer: string) {
        // Put the last char from buffer (first content after **)
        return buffer ? buffer[buffer.length - 1] : "";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        if (char === "*") {
            // Close bold on buffer-based '**'
            const buf = parser.buffer;
            if (buf.endsWith("**")) {
                return true;
            }
        }

        // Append char normally using parser's helper
        parser.addTextToNode(node, char);
        return false;
    }
};

// Italic handler (using *)
const italicHandler: PatternHandler = {
    name: "em_asterisk",
    elementName: "em",
    allowedNestings: [
        'strong_asterisk',
        'strong_underscore',
        'em_asterisk',
        'em_underscore',
        'code',
        'a'
    ],

    start(buffer: string): "no" | "potential" | "commit" {
        if (buffer.endsWith("*")) return "potential";
        // Check if buffer ends with * followed by a non-* and non-whitespace character
        if (buffer.match(/\*[^*\s]$/)) return "commit";
        return "no";
    },

    commit(buffer: string) {
        return buffer ? buffer[buffer.length - 1] : "";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        if (char === "*") {
            // Buffer-based close: previous char in buffer must not be space or '*'
            const buf = parser.buffer;
            const prev = buf.length >= 2 ? buf[buf.length - 2] : '';
            if (prev && prev !== ' ' && prev !== '*') {
                return true;
            }
        }

        // Append char normally using parser's helper
        parser.addTextToNode(node, char);
        return false;
    }
};

// Italic handler (using _)
const italicUnderscoreHandler: PatternHandler = {
    name: "em_underscore",
    elementName: "em",
    allowedNestings: [
        'strong_asterisk',
        'strong_underscore',
        'em_asterisk',
        'em_underscore',
        'code',
        'a'
    ],

    start(buffer: string): "no" | "potential" | "commit" {
        if (buffer.endsWith("_")) return "potential";
        // Check if buffer ends with _ followed by a non-_ and non-whitespace character
        if (buffer.match(/_[^_\s]$/)) return "commit";
        return "no";
    },

    commit(buffer: string) {
        return buffer ? buffer[buffer.length - 1] : "";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        if (char === "_") {
            // Buffer-based close for italic underscore
            const buf = parser.buffer;
            const prev = buf.length >= 2 ? buf[buf.length - 2] : '';
            if (prev && prev !== ' ' && prev !== '_') {
                return true;
            }
        }

        // Append char normally using parser's helper
        parser.addTextToNode(node, char);
        return false;
    }
};

// Bold handler (using __)
const boldUnderscoreHandler: PatternHandler = {
    name: "strong_underscore",
    elementName: "strong",
    allowedNestings: [
        'strong_asterisk',
        'strong_underscore',
        'em_asterisk',
        'em_underscore',
        'code',
        'a'
    ],

    start(buffer: string): "no" | "potential" | "commit" {
        // Full sequence: '_' -> '__' -> '__' + content
        if (buffer === "_") return "potential";
        if (buffer === "__") return "potential";
        // Commit only when we have '__' followed by a non-underscore, non-space
        if (/__[^_\s]$/.test(buffer)) return "commit";
        return "no";
    },

    commit(buffer: string) {
        return buffer ? buffer[buffer.length - 1] : "";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        if (char === "_") {
            // Close bold underscore on buffer-based '__' with valid previous char
            const buf = parser.buffer;
            if (buf.endsWith("__")) {
                const prev = buf.length >= 3 ? buf[buf.length - 3] : '';
                if (prev !== '_' && prev !== ' ') {
                    return true;
                }
            }
        }

        // Append char normally using parser's helper
        parser.addTextToNode(node, char);
        return false;
    }
};

// Code handler (using `)
const codeHandler: PatternHandler = {
    name: "code",
    elementName: "code",
    // Disallow all nested patterns inside inline code
    allowedNestings: [],

    start(buffer: string): "no" | "potential" | "commit" {
        if (buffer.endsWith("`")) return "potential";
        // Check if buffer ends with ` followed by a non-whitespace character
        if (buffer.match(/`[^\s]$/)) return "commit";
        return "no";
    },

    commit(buffer: string) {
        // Include the first content char after the opening backtick
        return buffer ? buffer[buffer.length - 1] : "";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        if (char === "`") {
            return true; // Done with code
        }

        // Append char normally
        const lastChild = node.children[node.children.length - 1];
        if (typeof lastChild === "string") {
            node.children[node.children.length - 1] = lastChild + char;
        } else {
            node.children.push(char);
        }
        return false;
    }
};

// Link handler
const linkHandler: PatternHandler = {
    name: "a",
    elementName: "a",
    allowedNestings: [
        'strong_asterisk',
        'strong_underscore',
        'em_asterisk',
        'em_underscore',
        'code'
    ],

    start(buffer: string): "no" | "potential" | "commit" {
        if (buffer.endsWith("[")) return "potential";
        // Check if buffer ends with [ followed by a non-whitespace character
        if (buffer.match(/\[[^\s]$/)) return "commit";
        return "no";
    },

    commit(buffer: string) {
        // Include the first character after '[' into the link text
        return buffer ? buffer[buffer.length - 1] : "";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        // Track state in attributes
        if (!node.attributes[0]) {
            node.attributes[0] = { phase: "text", buffer: "" };
        }

        const state = node.attributes[0];

        if (state.phase === "text") {
            if (char === "]") {
                state.phase = "between";
            } else {
                // Append to link text
                const lastChild = node.children[node.children.length - 1];
                if (typeof lastChild === "string") {
                    node.children[node.children.length - 1] = lastChild + char;
                } else {
                    node.children.push(char);
                }
            }
        } else if (state.phase === "between") {
            if (char === "(") {
                state.phase = "url";
            } else {
                // Malformed link, bail out
                return true;
            }
        } else if (state.phase === "url") {
            if (char === ")") {
                // Done, set href
                node.attributes[0] = { href: state.buffer };
                return true;
            } else {
                state.buffer += char;
            }
        }

        return false;
    }
};

// Unordered list handler
const unorderedListHandler: PatternHandler = {
    name: "ul",
    elementName: "ul",
    reuseTerminator: true,
    // Lists allow only inline content within a line
    allowedNestings: [
        'strong_asterisk',
        'strong_underscore',
        'em_asterisk',
        'em_underscore',
        'code',
        'a'
    ],

    start(buffer: string, parser?: MarkdownStreamParser): "no" | "potential" | "commit" {
        // Allow only leading whitespace before list marker at start of a line
        if ((/^[ \t]*[-*+]$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        if ((/^[ \t]*[-*+]\s$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "commit";
        }
        // Handle case where buffer has spaces + marker (e.g., " -")
        if ((/^[ \t]+[-*+]$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        if ((/^[ \t]+[-*+]\s$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "commit";
        }
        // Handle case where buffer is just spaces at start of line (waiting for list marker)
        if ((/^[ \t]+$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        return "no";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        if (char === "\n") {
            return true; // Done with list item
        }

        // Append char to node's children
        const lastChild = node.children[node.children.length - 1];
        if (typeof lastChild === "string") {
            node.children[node.children.length - 1] = lastChild + char;
        } else {
            node.children.push(char);
        }
        return false;
    }
};

// Ordered list handler
const orderedListHandler: PatternHandler = {
    name: "ol",
    elementName: "ol",
    reuseTerminator: true,
    allowedNestings: [
        'strong_asterisk',
        'strong_underscore',
        'em_asterisk',
        'em_underscore',
        'code',
        'a'
    ],

    start(buffer: string, parser?: MarkdownStreamParser): "no" | "potential" | "commit" {
        // Allow only leading whitespace before ordered list marker at start of a line
        if ((/^[ \t]*\d+$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        if ((/^[ \t]*\d+\.$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        if ((/^[ \t]*\d+\.\s$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "commit";
        }
        // Handle case where buffer has spaces + marker (e.g., " 1.")
        if ((/^[ \t]+\d+$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        if ((/^[ \t]+\d+\.$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        if ((/^[ \t]+\d+\.\s$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "commit";
        }
        // Handle case where buffer is just spaces at start of line (waiting for list marker)
        if ((/^[ \t]+$/).test(buffer)) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        return "no";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        if (char === "\n") {
            return true; // Done with list item
        }

        // Append char to node's children
        const lastChild = node.children[node.children.length - 1];
        if (typeof lastChild === "string") {
            node.children[node.children.length - 1] = lastChild + char;
        } else {
            node.children.push(char);
        }
        return false;
    }
};

// Blockquote handler
const blockquoteHandler: PatternHandler = {
    name: "blockquote",
    elementName: "blockquote",
    reuseTerminator: true,
    allowedNestings: [
        'strong_asterisk',
        'strong_underscore',
        'em_asterisk',
        'em_underscore',
        'code',
        'a'
    ],

    start(buffer: string, parser?: MarkdownStreamParser): "no" | "potential" | "commit" {
        if (buffer.endsWith(">")) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        if (buffer.endsWith("> ")) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "commit";
        }
        return "no";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        if (char === "\n") {
            return true; // Done with blockquote line
        }

        // Append char to node's children
        const lastChild = node.children[node.children.length - 1];
        if (typeof lastChild === "string") {
            node.children[node.children.length - 1] = lastChild + char;
        } else {
            node.children.push(char);
        }
        return false;
    }
};

// Horizontal rule handler
const horizontalRuleHandler: PatternHandler = {
    name: "hr",
    elementName: "hr",
    reuseTerminator: true,

    start(buffer: string, parser?: MarkdownStreamParser): "no" | "potential" | "commit" {
        if (buffer.endsWith("-") || buffer.endsWith("*") || buffer.endsWith("_")) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        if (buffer.endsWith("--") || buffer.endsWith("**") || buffer.endsWith("__")) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        if (buffer.endsWith("---") || buffer.endsWith("***") || buffer.endsWith("___")) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "potential";
        }
        if (buffer.endsWith("---\n") || buffer.endsWith("***\n") || buffer.endsWith("___\n")) {
            if (parser && !isAtStartOfLine(parser)) return "no";
            return "commit";
        }
        return "no";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        // If we get any character that's not \n, this is not a valid HR
        if (char !== "\n") {
            return true; // Fail as HR
        }
        // Only \n is valid, so we're done
        return true;
    }
};

// Export all handlers - order matters! Bold should come before italic
export const defaultHandlers: PatternHandler[] = [
    ...headerHandlers,
    boldHandler,
    boldUnderscoreHandler,
    italicHandler,
    italicUnderscoreHandler,
    codeHandler,
    linkHandler,
    unorderedListHandler,
    orderedListHandler,
    blockquoteHandler,
    horizontalRuleHandler
];

// Export individual handlers for specific use cases
export {
    createHeaderHandler,
    boldHandler,
    italicHandler,
    italicUnderscoreHandler,
    boldUnderscoreHandler,
    codeHandler,
    linkHandler,
    unorderedListHandler,
    orderedListHandler,
    blockquoteHandler,
    horizontalRuleHandler
};