export interface ParsedNode {
    element: string;
    children: (ParsedNode | string)[];
    attributes: Record<string, any>[];
}

export interface PatternHandler {
    name: string;
    elementName: string;
    start(buffer: string, parser?: StreamParser): "no" | "potential" | "commit";
    feed?(char: string, node: ParsedNode, parser: StreamParser): boolean;
    end?(buffer: string): boolean;
    upgrade?(node: ParsedNode, buffer: string, parser: StreamParser): void;
    commit?(buffer: string, parser: StreamParser): string | void;
    reuseTerminator?: boolean;
    allowedNestings?: string[] | null;
    prefixLength?(buffer: string): number;
}

interface ActiveEntry {
    pathIndex: number;
    handler: PatternHandler;
}

interface StreamParserOptions {
    rootElement?: string;
}

export class StreamParser {
    buffer = "";
    private activePath: ActiveEntry[] = [];
    private handlersMap: Map<string, PatternHandler>;

    public root: ParsedNode;

    constructor(private patterns: PatternHandler[], options: StreamParserOptions = {}) {
        this.handlersMap = new Map(this.patterns.map((p) => [p.name, p]));
        this.root = {
            element: options.rootElement ?? "root",
            children: [],
            attributes: []
        };
    }

    private getNodeByPath(path: ActiveEntry[]): ParsedNode {
        let node = this.root;
        for (const entry of path) {
            node = node.children[entry.pathIndex] as ParsedNode;
        }
        return node;
    }

    public getCurrentNode(): ParsedNode {
        return this.getNodeByPath(this.activePath);
    }

    private appendToCurrentNode(content: string | ParsedNode) {
        const current = this.getCurrentNode();

        if (typeof content === "string") {
            this.addTextWithNewlineSplitting(current, content);
        } else {
            current.children.push(content);
        }
    }

    private addTextWithNewlineSplitting(node: ParsedNode, text: string) {
        const parts = text.split('\n');

        for (let i = 0; i < parts.length; i++) {
            if (i > 0) {
                node.children.push('\n');
            }

            if (parts[i].length > 0) {
                const lastChild = node.children[node.children.length - 1];
                if (typeof lastChild === 'string' && lastChild !== '\n') {
                    node.children[node.children.length - 1] = lastChild + parts[i];
                } else {
                    node.children.push(parts[i]);
                }
            }
        }
    }

    public addTextToNode(node: ParsedNode, text: string) {
        this.addTextWithNewlineSplitting(node, text);
    }

    private flushBuffer() {
        if (this.buffer) {
            this.appendToCurrentNode(this.buffer);
            this.buffer = "";
        }
    }

    parse(content: string): ParsedNode {
        for (const char of content) {
            if (this.activePath.length > 0) {
                const current = this.getCurrentNode();
                const currentEntry = this.activePath[this.activePath.length - 1];

                this.buffer += char;

                if (this.hasPotentialPattern()) {
                    if (currentEntry.handler.feed && currentEntry.handler.feed(char, current, this)) {
                        if (currentEntry.handler.upgrade) {
                            currentEntry.handler.upgrade(current, this.buffer, this);
                        }
                        this.activePath.pop();
                        this.buffer = '';

                        if (currentEntry.handler.reuseTerminator) {
                            this.appendToCurrentNode(char);
                        }
                        continue;
                    } else {
                        const lastIdx = current.children.length - 1;
                        if (lastIdx >= 0) {
                            const lastChild = current.children[lastIdx];
                            if (typeof lastChild === 'string' && lastChild.length > 0) {
                                const updated = lastChild.slice(0, -1);
                                if (updated.length > 0) {
                                    current.children[lastIdx] = updated;
                                } else {
                                    current.children.pop();
                                }
                            }
                        }

                        this.tryCommit();
                    }
                    continue;
                }

                if (currentEntry.handler.feed) {
                    if (currentEntry.handler.feed(char, current, this)) {
                        if (currentEntry.handler.upgrade) {
                            currentEntry.handler.upgrade(current, this.buffer, this);
                        }
                        this.activePath.pop();
                        this.buffer = '';

                        if (currentEntry.handler.reuseTerminator) {
                            this.appendToCurrentNode(char);
                        }
                        continue;
                    }
                } else {
                    this.appendToCurrentNode(char);
                    this.buffer = '';
                    continue;
                }
            } else {
                this.buffer += char;

                const committed = this.tryCommit();

                if (!committed && !this.hasPotentialPattern()) {
                    this.flushBuffer();
                }
            }
        }

        return this.root;
    }

    public finalize(): ParsedNode {
        while (this.activePath.length > 0) {
            const currentEntry = this.activePath[this.activePath.length - 1];
            const current = this.getCurrentNode();
            if (currentEntry.handler.upgrade) {
                currentEntry.handler.upgrade(current, this.buffer, this);
            }
            this.activePath.pop();
        }
        return this.root;
    }

    private tryCommit(): boolean {
        let committed = false;

        const currentHandler = this.activePath.length > 0 ? this.activePath[this.activePath.length - 1].handler : null;
        const allowed = currentHandler?.allowedNestings;
        if (currentHandler && Array.isArray(allowed) && allowed.length === 0) {
            return false;
        }

        for (let i = 0; i < this.patterns.length; i++) {
            if (this.patterns[i].name === currentHandler?.name) {
                continue;
            }
            if (currentHandler && Array.isArray(allowed) && allowed.length > 0) {
                if (!allowed.includes(this.patterns[i].name)) {
                    continue;
                }
            }

            const result = this.patterns[i].start(this.buffer, this);

            if (result === "commit") {
                const handler = this.patterns[i];

                const prefixLen = handler.prefixLength?.(this.buffer) ?? 0;

                if (prefixLen > 0 && this.buffer.length > prefixLen) {
                    const textBeforePattern = this.buffer.slice(0, -prefixLen);
                    if (textBeforePattern.length > 0) {
                        this.appendToCurrentNode(textBeforePattern);
                    }
                }

                const initialNodeText = handler.commit?.(this.buffer, this) || "";
                this.buffer = "";
                const newNode: ParsedNode = {
                    element: handler.elementName,
                    children: [],
                    attributes: []
                };

                const parent = this.getCurrentNode();
                parent.children.push(newNode);
                this.activePath.push({
                    pathIndex: parent.children.length - 1,
                    handler: handler
                });
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
        const currentHandler = this.activePath.length > 0 ? this.activePath[this.activePath.length - 1].handler : null;
        const allowed = currentHandler?.allowedNestings;
        if (currentHandler && Array.isArray(allowed) && allowed.length === 0) {
            return false;
        }

        return this.patterns.some(p => {
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
        this.buffer = "";
        this.activePath = [];
        this.root = {
            element: this.root.element,
            children: [],
            attributes: []
        };
    }
}
