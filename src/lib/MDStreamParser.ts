import { defaultHandlers } from './handlers';

export interface ParsedMDNode {
    element: string;
    children: (ParsedMDNode | string)[];
    attributes: Record<string, any>[];
}

export interface PatternHandler {
    name: string;        // Unique identifier for the map (e.g., "strong_asterisk", "strong_underscore")
    elementName: string; // Element name for the tree (e.g., "strong", "em")
    start(buffer: string, parser?: MarkdownStreamParser): "no" | "potential" | "commit";
    feed?(char: string, node: ParsedMDNode, parser: MarkdownStreamParser): boolean;
    end?(buffer: string): boolean;
    upgrade?(node: ParsedMDNode, buffer: string, parser: MarkdownStreamParser): void;
    // Optional commit hook: return the exact string to place as initial content
    // of the newly created node (e.g., "" or the last char of the buffer).
    commit?(buffer: string, parser: MarkdownStreamParser): string | void;
    reuseTerminator?: boolean; // if true, append the char that ended the pattern to parent
    // Nesting policy: undefined/null => allow all; [] => disallow all; [names...] => allow only listed
    allowedNestings?: string[] | null;
    // Returns the length of the pattern prefix (e.g., 2 for "**", 1 for "*", 1 for "`")
    // Used to determine how much text before the pattern should be flushed to parent
    prefixLength?(buffer: string): number;
}

interface ActiveEntry {
    pathIndex: number; // index into nested children
    handler: PatternHandler; // the handler that created this node
}

export class MarkdownStreamParser {
    buffer = "";
    private activePath: ActiveEntry[] = []; // stack of active entries with path and handler
    private handlersMap: Map<string, PatternHandler>;

    public root: ParsedMDNode = {
        element: "root",
        children: [],
        attributes: []
    };

    constructor(private patterns: PatternHandler[] = []) {
        // Use default handlers if none provided
        if (patterns.length === 0) {
            this.patterns = defaultHandlers;
        } else {
            this.patterns = patterns;
        }
        this.handlersMap = new Map(this.patterns.map((p) => [p.name, p]));
    }

    private getNodeByPath(path: ActiveEntry[]): ParsedMDNode {
        let node = this.root;
        for (const entry of path) {
            node = node.children[entry.pathIndex] as ParsedMDNode;
        }
        return node;
    }

    public getCurrentNode(): ParsedMDNode {
        return this.getNodeByPath(this.activePath);
    }

    private appendToCurrentNode(content: string | ParsedMDNode) {
        const current = this.getCurrentNode();

        if (typeof content === "string") {
            this.addTextWithNewlineSplitting(current, content);
        } else {
            current.children.push(content);
        }
    }

    private addTextWithNewlineSplitting(node: ParsedMDNode, text: string) {
        // Split text by newlines
        const parts = text.split('\n');

        for (let i = 0; i < parts.length; i++) {
            if (i > 0) {
                // Add newline as separate element
                node.children.push('\n');
            }

            if (parts[i].length > 0) {
                // Add text content
                const lastChild = node.children[node.children.length - 1];
                if (typeof lastChild === 'string' && lastChild !== '\n') {
                    // Merge with previous text node (but not if it's a newline)
                    node.children[node.children.length - 1] = lastChild + parts[i];
                } else {
                    // Append as new child
                    node.children.push(parts[i]);
                }
            }
        }
    }

    // Public method for handlers to use
    public addTextToNode(node: ParsedMDNode, text: string) {
        this.addTextWithNewlineSplitting(node, text);
    }

    private flushBuffer() {
        if (this.buffer) {
            this.appendToCurrentNode(this.buffer);
            this.buffer = "";
        }
    }

    parse(content: string): ParsedMDNode {
        for (const char of content) {
            // If we have an active node, feed its handler the char
            if (this.activePath.length > 0) {
                const current = this.getCurrentNode();
                const currentEntry = this.activePath[this.activePath.length - 1];

                this.buffer += char;

                if (this.hasPotentialPattern()) {
                    if (currentEntry.handler.feed && currentEntry.handler.feed(char, current, this)) {
                        // Handler signaled it's done
                        if (currentEntry.handler.upgrade) {
                            currentEntry.handler.upgrade(current, this.buffer, this);
                        }
                        this.activePath.pop();
                        this.buffer = ''; // Clear buffer when closing

                        // Optionally reuse the terminator character
                        if (currentEntry.handler.reuseTerminator) {
                            this.appendToCurrentNode(char);
                        }
                        continue;
                    } else {
                        // else, we still have a potential, but we just fed
                        // it, so we have to take it back from here.
                        const lastIdx = current.children.length - 1;
                        if (lastIdx >= 0) {
                            const lastChild = current.children[lastIdx];
                            if (typeof lastChild === 'string' && lastChild.length > 0) {
                                const updated = lastChild.slice(0, -1);
                                if (updated.length > 0) {
                                    current.children[lastIdx] = updated;
                                } else {
                                    // remove empty node
                                    current.children.pop();
                                }
                            }
                        }

                        this.tryCommit();
                    }
                    // Nested pattern started or is potentially starting; do not feed to current yet
                    continue;
                }

                // First, try to feed the character to the current handler
                if (currentEntry.handler.feed) {
                    if (currentEntry.handler.feed(char, current, this)) {
                        // Handler signaled it's done
                        if (currentEntry.handler.upgrade) {
                            currentEntry.handler.upgrade(current, this.buffer, this);
                        }
                        this.activePath.pop();
                        this.buffer = ''; // Clear buffer when closing

                        // Optionally reuse the terminator character
                        if (currentEntry.handler.reuseTerminator) {
                            this.appendToCurrentNode(char);
                        }
                        continue;
                    }
                } else {
                    // No feed method; treat as plain text container
                    this.appendToCurrentNode(char);
                    this.buffer = ''; // Clear buffer
                    continue;
                }
            } else {
                // No active handler, accumulate in buffer and check patterns
                this.buffer += char;

                const committed = this.tryCommit();

                // If no pattern wants the buffer and no potentials, flush it
                if (!committed && !this.hasPotentialPattern()) {
                    this.flushBuffer();
                }
            }
        }

        return this.root;
    }

    private tryCommit(): boolean {
        let committed = false;

        // Get the currently active handler to filter it out
        const currentHandler = this.activePath.length > 0 ? this.activePath[this.activePath.length - 1].handler : null;
        const allowed = currentHandler?.allowedNestings;
        if (currentHandler && Array.isArray(allowed) && allowed.length === 0) {
            // Explicitly disallow starting any nested pattern inside current handler
            return false;
        }

        for (let i = 0; i < this.patterns.length; i++) {
            // Skip the pattern that matches the currently active handler
            // This prevents trying to start a new element of the same type when we're already inside one
            if (this.patterns[i].name === currentHandler?.name) {
                continue;
            }
            // Enforce whitelist if provided
            if (currentHandler && Array.isArray(allowed) && allowed.length > 0) {
                if (!allowed.includes(this.patterns[i].name)) {
                    continue;
                }
            }

            const result = this.patterns[i].start(this.buffer, this);

            if (result === "commit") {
                const handler = this.patterns[i];

                // Calculate prefix length (how many chars make up the pattern opener + first content char)
                // Default: 2 for "**" + 1 for first char = 3, but let handler specify
                const prefixLen = handler.prefixLength?.(this.buffer) ?? 0;

                // Flush any text that comes BEFORE the pattern prefix
                if (prefixLen > 0 && this.buffer.length > prefixLen) {
                    const textBeforePattern = this.buffer.slice(0, -prefixLen);
                    if (textBeforePattern.length > 0) {
                        this.appendToCurrentNode(textBeforePattern);
                    }
                }

                // Let handler decide what initial content to insert into the new node
                const initialNodeText = handler.commit?.(this.buffer, this) || "";
                // Discard remaining buffer when committing to a pattern start
                this.buffer = "";
                // Create new node under current container and descend
                const newNode: ParsedMDNode = {
                    element: handler.elementName,
                    children: [],
                    attributes: []
                };

                // Append node under current container and go one level deeper
                const parent = this.getCurrentNode();
                parent.children.push(newNode);
                this.activePath.push({
                    pathIndex: parent.children.length - 1,
                    handler: handler
                });
                // If handler requested initial text, add it now
                if (initialNodeText) {
                    this.addTextToNode(newNode, initialNodeText);
                }
                committed = true;
                break;
            }
        }

        return committed;
    }

    private hasPotentialPattern(): boolean {
        // Get the currently active handler to filter it out
        const currentHandler = this.activePath.length > 0 ? this.activePath[this.activePath.length - 1].handler : null;
        const allowed = currentHandler?.allowedNestings;
        if (currentHandler && Array.isArray(allowed) && allowed.length === 0) {
            return false;
        }

        return this.patterns.some(p => {
            // Skip the pattern that matches the currently active handler
            if (p.name === currentHandler?.name) {
                return false;
            }
            if (currentHandler && Array.isArray(allowed) && allowed.length > 0) {
                if (!allowed.includes(p.name)) {
                    return false;
                }
            }
            return p.start(this.buffer, this) === "potential" || p.start(this.buffer, this) === "commit";
        });
    }

    public clearAllStates(): void {
        // Reset streaming parser state to initial values
        this.buffer = "";
        this.activePath = [];
        this.root = {
            element: "root",
            children: [],
            attributes: []
        };
    }
}