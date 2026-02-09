import type {
	ParsedNode,
	PatternHandler,
	StartResult,
	StepControl,
	Writer
} from './types';

interface ActiveStateEntry {
	node: ParsedNode;
	handler: PatternHandler<any, any>;
	state: unknown;
}

type CommitStartResult = Extract<StartResult<any>, { kind: 'commit' }>;

type StartProbe =
	| { kind: 'none' }
	| { kind: 'potential' }
	| {
		kind: 'commit';
		handler: PatternHandler<any, any>;
		result: CommitStartResult;
	};

export interface StreamParserOptions {
	rootElement?: string;
}

export class StreamParser {
	public buffer = '';
	public root: ParsedNode;

	private activeStack: ActiveStateEntry[] = [];
	private lineStart = true;

	constructor(private readonly handlers: PatternHandler[], options: StreamParserOptions = {}) {
		this.root = {
			element: options.rootElement ?? 'root',
			children: [],
			attributes: {}
		};
	}

	public parse(content: string): ParsedNode {
		// Process input one character at a time and resolve buffered parser steps as far as possible.
		for (const char of content) {
			this.buffer += char;

			while (this.buffer.length > 0) {
				if (!this.processCurrentBufferedChar({ allowStarts: true })) {
					break;
				}
			}
		}

		return this.root;
	}

	public clearAllStates(): void {
		this.buffer = '';
		this.activeStack = [];
		this.lineStart = true;
		this.root = {
			element: this.root.element,
			children: [],
			attributes: {}
		};
	}

	private getCurrentNode(): ParsedNode {
		const active = this.activeStack[this.activeStack.length - 1];
		return active?.node ?? this.root;
	}

	private processCurrentBufferedChar(options: { allowStarts: boolean }): boolean {
		const char = this.buffer[0];
		const active = this.activeStack[this.activeStack.length - 1];

		if (active) {
			const writer = this.createWriter(active.node);
			let consumed = true;
			const control: StepControl = {
				preventConsume: () => {
					consumed = false;
				}
			};

			const shouldClose = active.handler.step({
				char,
				node: active.node,
				parser: this,
				writer,
				state: active.state,
				control
			});

			if (consumed) {
				this.updateLineStartForText(char);
				this.buffer = this.buffer.slice(1);
			}

			if (shouldClose) {
				this.popActiveNode();
				return true;
			}

			if (consumed) {
				return true;
			}
		}

		if (options.allowStarts) {
			const probe = this.probeStart();
			if (probe.kind === 'commit') {
				this.commitFromProbe(probe.handler, probe.result);
				return true;
			}
			if (probe.kind === 'potential') {
				return false;
			}
		}

		this.createWriter(this.getCurrentNode()).text(char);
		this.updateLineStartForText(char);
		this.buffer = this.buffer.slice(1);
		return true;
	}

	private probeStart(): StartProbe {
		const currentHandler = this.activeStack[this.activeStack.length - 1]?.handler;
		const candidates = this.getCandidates(currentHandler);
		let hasPotential = false;
		const startContext = {
			lineStart: this.lineStart,
			currentNode: this.getCurrentNode()
		};

		for (const handler of candidates) {
			const result = handler.start(this.buffer, startContext);
			if (result.kind === 'commit') {
				return {
					kind: 'commit',
					handler: handler as PatternHandler<any, any>,
					result
				};
			}
			if (result.kind === 'potential') {
				hasPotential = true;
			}
		}

		if (hasPotential) {
			return { kind: 'potential' };
		}

		return { kind: 'none' };
	}

	private commitFromProbe(
		handler: PatternHandler<any, any>,
		result: CommitStartResult
	): void {
		const consumed = result.consumed ?? this.buffer.length;
		if (consumed <= 0 || consumed > this.buffer.length) {
			throw new Error(
				`Invalid start consumed length ${consumed} for buffer length ${this.buffer.length} on ${handler.elementName}`
			);
		}

		const consumedPrefix = this.buffer.slice(0, consumed);
		this.buffer = this.buffer.slice(consumed);
		this.updateLineStartForText(consumedPrefix);

		const parent = this.getCurrentNode();
		const node: ParsedNode = {
			element: handler.elementName,
			children: [],
			attributes: {}
		};
		parent.children.push(node);

		const state = handler.createState(result.seed, this, node);
		this.activeStack.push({
			node,
			handler,
			state
		});

		if (result.initialText) {
			this.createWriter(node).text(result.initialText);
		}
	}

	private getCandidates(currentHandler?: PatternHandler<any, any>): PatternHandler[] {
		if (!currentHandler) {
			return this.handlers;
		}

		const allowed = currentHandler.allowedNestings;
		if (Array.isArray(allowed) && allowed.length === 0) {
			return [];
		}

		return this.handlers.filter((handler) => {
			if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(handler.elementName)) {
				return false;
			}
			return true;
		});
	}

	private createWriter(node: ParsedNode): Writer {
		return {
			text: (s: string) => {
				this.addTextWithNewlineSplitting(node, s);
			},
			setAttr: (key: string, value: unknown) => {
				node.attributes[key] = value;
			}
		};
	}

	private addTextWithNewlineSplitting(node: ParsedNode, text: string): void {
		if (!text) {
			return;
		}

		const parts = text.split('\n');
		for (let i = 0; i < parts.length; i += 1) {
			if (i > 0) {
				node.children.push('\n');
			}

			if (parts[i].length === 0) {
				continue;
			}

			const lastChild = node.children[node.children.length - 1];
			if (typeof lastChild === 'string' && lastChild !== '\n') {
				node.children[node.children.length - 1] = lastChild + parts[i];
				continue;
			}
			node.children.push(parts[i]);
		}
	}

	private updateLineStartForText(text: string): void {
		if (!text) {
			return;
		}
		this.lineStart = text[text.length - 1] === '\n';
	}

	private popActiveNode(): void {
		const active = this.activeStack.pop();
		if (!active) {
			return;
		}
		active.handler.onFinalize?.({
			node: active.node,
			parser: this,
			writer: this.createWriter(active.node),
			state: active.state
		});
	}
}
