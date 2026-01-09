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

        upgrade(_node: ParsedMDNode, _buffer: string, _parser: MarkdownStreamParser): void {
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

    prefixLength(): number {
        // Pattern is ** + first content char = 3 chars
        return 3;
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

    prefixLength(): number {
        // Pattern is * + first content char = 2 chars
        return 2;
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

    prefixLength(): number {
        // Pattern is _ + first content char = 2 chars
        return 2;
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

    prefixLength(): number {
        // Pattern is __ + first content char = 3 chars
        return 3;
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

    prefixLength(): number {
        // Pattern is ` + first content char = 2 chars
        return 2;
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

    prefixLength(): number {
        // Pattern is [ + first content char = 2 chars
        return 2;
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

// Helper to get the last list in the current node's children (for preventing new list creation)
function getLastListInParent(parser: MarkdownStreamParser): ParsedMDNode | null {
    const current = parser.getCurrentNode();
    // Check if we just finished a list item and the parent is a list
    if (current.element === 'ul' || current.element === 'ol') {
        return current;
    }
    // Check if the last child of current is a list that we can append to
    if (current.children.length > 0) {
        const lastChild = current.children[current.children.length - 1];
        if (typeof lastChild !== 'string' && (lastChild.element === 'ul' || lastChild.element === 'ol')) {
            // If there's a list as the last child, we can continue appending to it
            return lastChild;
        }
    }
    return null;
}

// Helper to check if we're currently inside a list element
function isInsideListElement(parser: MarkdownStreamParser): boolean {
    const current = parser.getCurrentNode();
    return current.element === 'ul' || current.element === 'ol';
}

// Unordered list handler - creates ul and first li
const unorderedListHandler: PatternHandler = {
    name: "ul",
    elementName: "ul",
    reuseTerminator: true, // Reuse the newline so subsequent patterns can detect start of line
    // Lists can nest list items
    allowedNestings: [
        'li',
        'strong_asterisk',
        'strong_underscore',
        'em_asterisk',
        'em_underscore',
        'code',
        'a'
    ],

    start(buffer: string, parser?: MarkdownStreamParser): "no" | "potential" | "commit" {
        // Don't start a new list if we're already in one
        if (parser && isInsideListElement(parser)) return "no";

        // Check if there's already a list we can continue
        if (parser) {
            const existingList = getLastListInParent(parser);
            if (existingList) return "no"; // Let the list item handler take over
        }

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
        return "no";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        // Track state: are we waiting to see if this is a new list item?
        // We use node.attributes[0].waitingForListItem for this
        if (!node.attributes[0]) {
            node.attributes[0] = { waitingForListItem: false, markerBuffer: '' };
        }
        const state = node.attributes[0];

        // Get or create the current li
        let currentLi: ParsedMDNode | null = null;
        for (let i = node.children.length - 1; i >= 0; i--) {
            const child = node.children[i];
            if (typeof child !== 'string' && child.element === 'li') {
                currentLi = child;
                break;
            }
        }

        // If no li exists, create one
        if (!currentLi) {
            currentLi = { element: 'li', children: [], attributes: [] };
            node.children.push(currentLi);
        }

        if (char === "\n") {
            if (state.waitingForListItem) {
                // We got a second newline - this is an empty line, end the list
                state.waitingForListItem = false;
                return true;
            }
            // End of a line - set flag to check for list continuation
            state.waitingForListItem = true;
            state.markerBuffer = '';
            return false;
        }

        if (state.waitingForListItem) {
            // We're at the start of a new line after a list item
            state.markerBuffer += char;

            // Check if this could be a list marker
            const isUnorderedMarker = /^[ \t]*[-*+]$/.test(state.markerBuffer);
            const isUnorderedComplete = /^[ \t]*[-*+] $/.test(state.markerBuffer);
            const isOrderedMarker = /^[ \t]*\d+\.?$/.test(state.markerBuffer);
            const isOrderedComplete = /^[ \t]*\d+\. $/.test(state.markerBuffer);
            const couldBeContinuation = /^[ \t]*$/.test(state.markerBuffer); // just spaces so far

            if (isUnorderedComplete || isOrderedComplete) {
                // It's a new list item! Create a new li
                currentLi = { element: 'li', children: [], attributes: [] };
                node.children.push(currentLi);
                state.waitingForListItem = false;
                state.markerBuffer = '';
                return false;
            }

            if (isUnorderedMarker || isOrderedMarker || couldBeContinuation || char === ' ' || char === '\t') {
                // Still could be a list item, wait for more
                return false;
            }

            // Not a list item - this is the end of the list
            // Don't consume this character, let it go back to parent
            state.waitingForListItem = false;
            return true;
        }

        // Normal case: append char to the current li
        parser.addTextToNode(currentLi, char);
        return false;
    },

    // Custom commit to create initial li
    commit(_buffer: string, _parser: MarkdownStreamParser): string {
        // We'll create the li structure - don't return initial text here
        // The li will be created in feed
        return "";
    }
};

// Ordered list handler - creates ol and first li
const orderedListHandler: PatternHandler = {
    name: "ol",
    elementName: "ol",
    reuseTerminator: true, // Reuse the newline so subsequent patterns can detect start of line
    allowedNestings: [
        'li',
        'strong_asterisk',
        'strong_underscore',
        'em_asterisk',
        'em_underscore',
        'code',
        'a'
    ],

    start(buffer: string, parser?: MarkdownStreamParser): "no" | "potential" | "commit" {
        // Don't start a new list if we're already in one
        if (parser && isInsideListElement(parser)) return "no";

        // Check if there's already a list we can continue
        if (parser) {
            const existingList = getLastListInParent(parser);
            if (existingList) return "no";
        }

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
        return "no";
    },

    feed(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean {
        // Track state: are we waiting to see if this is a new list item?
        if (!node.attributes[0]) {
            node.attributes[0] = { waitingForListItem: false, markerBuffer: '' };
        }
        const state = node.attributes[0];

        // Get or create the current li
        let currentLi: ParsedMDNode | null = null;
        for (let i = node.children.length - 1; i >= 0; i--) {
            const child = node.children[i];
            if (typeof child !== 'string' && child.element === 'li') {
                currentLi = child;
                break;
            }
        }

        // If no li exists, create one
        if (!currentLi) {
            currentLi = { element: 'li', children: [], attributes: [] };
            node.children.push(currentLi);
        }

        if (char === "\n") {
            if (state.waitingForListItem) {
                // Empty line - end the list
                state.waitingForListItem = false;
                return true;
            }
            state.waitingForListItem = true;
            state.markerBuffer = '';
            return false;
        }

        if (state.waitingForListItem) {
            state.markerBuffer += char;

            const isUnorderedMarker = /^[ \t]*[-*+]$/.test(state.markerBuffer);
            const isUnorderedComplete = /^[ \t]*[-*+] $/.test(state.markerBuffer);
            const isOrderedMarker = /^[ \t]*\d+\.?$/.test(state.markerBuffer);
            const isOrderedComplete = /^[ \t]*\d+\. $/.test(state.markerBuffer);
            const couldBeContinuation = /^[ \t]*$/.test(state.markerBuffer);

            if (isUnorderedComplete || isOrderedComplete) {
                currentLi = { element: 'li', children: [], attributes: [] };
                node.children.push(currentLi);
                state.waitingForListItem = false;
                state.markerBuffer = '';
                return false;
            }

            if (isUnorderedMarker || isOrderedMarker || couldBeContinuation || char === ' ' || char === '\t') {
                return false;
            }

            state.waitingForListItem = false;
            return true;
        }

        parser.addTextToNode(currentLi, char);
        return false;
    },

    commit(_buffer: string, _parser: MarkdownStreamParser): string {
        return "";
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

// Table handler - true character-by-character streaming
// Each character is immediately visible in the current cell
// Separator rows (| --- | --- |) are filtered out
const tableHandler: PatternHandler = {
    name: "table",
    elementName: "table",
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
        // Only match at start of line
        if (parser && !isAtStartOfLine(parser)) return "no";

        // Table starts immediately when we see | at start of line
        if (buffer === "|") return "commit";

        return "no";
    },

    commit(_buffer: string, _parser: MarkdownStreamParser): string {
        return "";
    },

    prefixLength(_buffer: string): number {
        return 1; // Just the initial |
    },

    // Clean up empty cells/rows and filter separator rows on table end
    // Clean up empty cells/rows and filter separator rows on table end
    upgrade(node: ParsedMDNode, _buffer: string, _parser: MarkdownStreamParser): void {
        // Just remove empty rows at the end (cleanup)
        node.children = node.children.filter(child => {
            if (typeof child === 'string') return true;
            const row = child as ParsedMDNode;
            if (row.element !== 'tr') return true;
            return row.children.length > 0;
        });
    },

    feed(char: string, node: ParsedMDNode, _parser: MarkdownStreamParser): boolean {
        // Initialize state on first call
        if (!node.attributes[0]) {
            node.attributes[0] = {
                isConfirmed: false, // Start unconfirmed
                rowBuffer: '',      // Buffer for unconfirmed content
                currentRow: null,   // Will be created when confirmed
                currentCell: null,
                afterPipe: true
            };
        }

        const state = node.attributes[0];

        // Helper to process a character into the live AST (used when confirmed)
        const processChar = (c: string) => {
            const row = state.currentRow as ParsedMDNode;

            if (c === '|') {
                const currentCell = state.currentCell as ParsedMDNode;
                const cellText = (currentCell.children[0] as string || '').trim();

                // If it's a leading pipe for a new cell that is empty, just mark afterPipe
                if (state.afterPipe && !cellText) {
                    state.afterPipe = false; // It was a leading pipe
                    return;
                }

                // Update current cell text
                currentCell.children[0] = cellText;

                // Create new cell
                const newCell: ParsedMDNode = {
                    element: 'td',
                    children: [''],
                    attributes: []
                };
                row.children.push(newCell);
                state.currentCell = newCell;
                state.afterPipe = true;
                return;
            }

            // Regular char
            const currentCell = state.currentCell as ParsedMDNode;
            currentCell.children[0] = (currentCell.children[0] as string || '') + c;
            state.afterPipe = false;
        };

        // NEWLINE HANDLING
        if (char === '\n') {
            if (!state.isConfirmed) {
                // End of unconfirmed row. Check if it's a separator or real data.
                const isPotentialSeparator = /^[\s|:-]*$/.test(state.rowBuffer);
                const isValidSeparator = /^\|\s*[-:]+\s*(\|\s*[-:]+\s*)*\|?$/.test(state.rowBuffer.trim());

                if (isValidSeparator || isPotentialSeparator) {
                    // It's a separator or noise. Discard.
                    state.isConfirmed = false;
                    state.rowBuffer = '';
                    state.currentRow = null;
                    state.currentCell = null;
                    state.afterPipe = true;
                    return false;
                }

                // It wasn't a separator? Commit it as a data row.
                const newRow: ParsedMDNode = {
                    element: 'tr',
                    children: [{ element: 'td', children: [''], attributes: [] }],
                    attributes: []
                };
                node.children.push(newRow);
                state.currentRow = newRow;
                state.currentCell = newRow.children[0];
                state.isConfirmed = true;

                // Flush buffer
                for (const bufferedChar of state.rowBuffer) {
                    processChar(bufferedChar);
                }
            }

            // Prepare for next row
            if (state.currentRow) {
                // Clean up previous row
                const row = state.currentRow as ParsedMDNode;
                row.children = row.children.filter(cell => {
                    if (typeof cell === 'string') return true;
                    return (cell as ParsedMDNode).children.join('').trim().length > 0;
                });
            }

            state.isConfirmed = false;
            state.rowBuffer = '';
            state.currentRow = null;
            state.currentCell = null;
            state.afterPipe = true;
            return false;
        }

        // CONTENT HANDLING
        if (!state.isConfirmed) {
            state.rowBuffer += char;

            // Check if this character forces confirmation
            // Allowed separator characters: | - : space tab
            const isSeparatorChar = /[|\-:\s]/.test(char);

            if (!isSeparatorChar) {
                // Found a data character (letter, number, etc)! definitely NOT a separator row.
                state.isConfirmed = true;

                // Initialize the row in AST
                const newRow: ParsedMDNode = {
                    element: 'tr',
                    children: [{ element: 'td', children: [''], attributes: [] }],
                    attributes: []
                };
                node.children.push(newRow);
                state.currentRow = newRow;
                state.currentCell = newRow.children[0];
                state.afterPipe = true;

                // Flush the buffer into the AST
                for (const bufferedChar of state.rowBuffer) {
                    processChar(bufferedChar);
                }
            }
            return false;
        }

        // If confirmed, just stream directly
        processChar(char);
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
    tableHandler,
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
    tableHandler,
    horizontalRuleHandler
};