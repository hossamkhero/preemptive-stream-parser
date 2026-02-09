import type { ParsedNode, PatternHandler } from '../engine/types';

type JsonSeed = {
	rootKind: '{' | '[';
};

type ContainerFrame = {
	node: ParsedNode;
	type: 'object' | 'array';
	expectingKey?: boolean;
	expectingValue?: boolean;
	currentPair?: ParsedNode | null;
};

type JsonState = {
	stack: ContainerFrame[];
	buffer: string;
	inString: boolean;
	isEscaped: boolean;
	stringValueTarget: 'key' | 'value' | null;
};

const createValueNode = (value: string, type: string): ParsedNode => ({
	element: 'value',
	children: [value],
	attributes: { type }
});

const createPairNode = (): ParsedNode => ({
	element: 'pair',
	children: [
		'',
		createValueNode('null', 'null')
	],
	attributes: {}
});

const buildPrimitiveNode = (raw: string): ParsedNode => {
	const trimmed = raw.trim();

	const booleanPrefixes = ['t', 'tr', 'tru', 'true', 'f', 'fa', 'fal', 'fals', 'false'];
	if (booleanPrefixes.includes(trimmed)) {
		const value = trimmed.startsWith('f') ? 'false' : 'true';
		return createValueNode(value, 'boolean');
	}

	if (trimmed === 'n' || trimmed === 'nu' || trimmed === 'nul' || trimmed === 'null') {
		return createValueNode('null', 'null');
	}

	if (/^-?[\d.]/.test(trimmed) || trimmed === '-') {
		let numberString = trimmed;

		if (numberString === '-') {
			return createValueNode('0', 'number');
		}

		if (numberString.endsWith('.')) {
			numberString = numberString.slice(0, -1);
		}

		numberString = numberString.replace(/[eE][+-]?$/, '');

		if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(numberString)) {
			return createValueNode(numberString, 'number');
		}

		if (/^-?\d+$/.test(numberString)) {
			return createValueNode(numberString, 'number');
		}

		const integerMatch = numberString.match(/^-?\d+/);
		if (integerMatch) {
			return createValueNode(integerMatch[0], 'number');
		}

		return createValueNode('0', 'number');
	}

	if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
		return createValueNode(trimmed, 'number');
	}

	return createValueNode(trimmed, 'primitive');
};

const currentContainer = (state: JsonState): ContainerFrame | undefined =>
	state.stack[state.stack.length - 1];

const updateStreamingStringTarget = (state: JsonState): void => {
	const container = currentContainer(state);
	if (!container) {
		return;
	}

	if (state.stringValueTarget === 'key' && container.type === 'object' && container.currentPair) {
		container.currentPair.children[0] = state.buffer;
		return;
	}

	if (state.stringValueTarget !== 'value') {
		return;
	}

	if (container.type === 'object' && container.currentPair) {
		const valueNode = container.currentPair.children[1];
		if (
			typeof valueNode !== 'string' &&
			valueNode.element === 'value' &&
			valueNode.attributes.type === 'string'
		) {
			valueNode.children = [state.buffer];
		}
		return;
	}

	if (container.type === 'array') {
		const lastChild = container.node.children[container.node.children.length - 1];
		if (
			typeof lastChild !== 'string' &&
			lastChild.element === 'value' &&
			lastChild.attributes.type === 'string'
		) {
			lastChild.children = [state.buffer];
		}
	}
};

const attachPrimitiveToContainer = (container: ContainerFrame, valueNode: ParsedNode): void => {
	if (container.type === 'object' && container.currentPair) {
		container.currentPair.children[1] = valueNode;
		container.currentPair = null;
		container.expectingKey = true;
		return;
	}

	if (container.type === 'array') {
		const lastChild = container.node.children[container.node.children.length - 1];
		if (lastChild && typeof lastChild !== 'string' && lastChild.element === 'value') {
			lastChild.children = valueNode.children;
			lastChild.attributes = valueNode.attributes;
		} else {
			container.node.children.push(valueNode);
		}
	}
};

export const jsonHandler: PatternHandler<JsonState, JsonSeed> = {
	elementName: 'json',
	allowedNestings: [],

	start(buffer: string) {
		if (!buffer.startsWith('{') && !buffer.startsWith('[')) {
			return { kind: 'no' };
		}

		const rootKind = buffer[0] as '{' | '[';
		return {
			kind: 'commit',
			seed: { rootKind },
			consumed: 1
		};
	},

	createState(seed, _parser, node) {
		const rootValueNode: ParsedNode =
			seed.rootKind === '{'
				? { element: 'object', children: [], attributes: {} }
				: { element: 'array', children: [], attributes: {} };
		node.children.push(rootValueNode);

		return {
			stack: [
				seed.rootKind === '{'
					? { node: rootValueNode, type: 'object', expectingKey: true, currentPair: null }
					: { node: rootValueNode, type: 'array', expectingValue: true, currentPair: null }
			],
			buffer: '',
			inString: false,
			isEscaped: false,
			stringValueTarget: null
		};
	},

	step(ctx) {
		const { char, state } = ctx;

		const flushBuffer = (): void => {
			const value = state.buffer.trim();
			if (!value) {
				return;
			}

			const container = currentContainer(state);
			if (!container) {
				state.buffer = '';
				return;
			}

			const valueNode = buildPrimitiveNode(value);
			attachPrimitiveToContainer(container, valueNode);
			state.buffer = '';
		};

		if (state.inString) {
			if (state.isEscaped) {
				const escapeMap: Record<string, string> = {
					n: '\n',
					t: '\t',
					r: '\r',
					b: '\b',
					f: '\f',
					'"': '"',
					'\\': '\\',
					'/': '/'
				};

				state.buffer += escapeMap[char] ?? char;
				state.isEscaped = false;
				updateStreamingStringTarget(state);
				return false;
			}

			if (char === '\\') {
				state.isEscaped = true;
				return false;
			}

			if (char === '"') {
				state.inString = false;
				const container = currentContainer(state);

				if (state.stringValueTarget === 'key' && container?.type === 'object' && container.currentPair) {
					container.expectingKey = false;
					state.buffer = '';
					state.stringValueTarget = null;
					return false;
				}

				if (state.stringValueTarget === 'value' && container) {
					if (container.type === 'object' && container.currentPair) {
						container.currentPair = null;
						container.expectingKey = true;
					}
					if (container.type === 'array') {
						container.expectingValue = false;
					}
					state.buffer = '';
					state.stringValueTarget = null;
					return false;
				}

				state.buffer = '';
				return false;
			}

			state.buffer += char;
			updateStreamingStringTarget(state);
			return false;
		}

		if (char === '"') {
			state.inString = true;
			state.buffer = '';
			const container = currentContainer(state);

			if (container?.type === 'object' && container.expectingKey) {
				state.stringValueTarget = 'key';
				const pair = createPairNode();
				container.node.children.push(pair);
				container.currentPair = pair;
				return false;
			}

			state.stringValueTarget = 'value';
			const valueNode = createValueNode('', 'string');
			if (container?.type === 'object' && container.currentPair) {
				container.currentPair.children[1] = valueNode;
			} else if (container?.type === 'array') {
				container.node.children.push(valueNode);
			}

			return false;
		}

		if (char === '{') {
			flushBuffer();
			const objectNode: ParsedNode = { element: 'object', children: [], attributes: {} };
			const container = currentContainer(state);

			if (!container) {
				return false;
			}

			if (container.type === 'object' && container.currentPair) {
				container.currentPair.children[1] = objectNode;
				container.currentPair = null;
				container.expectingKey = true;
			} else if (container.type === 'array') {
				container.node.children.push(objectNode);
				container.expectingValue = false;
			}

			state.stack.push({ node: objectNode, type: 'object', expectingKey: true, currentPair: null });
			return false;
		}

		if (char === '[') {
			flushBuffer();
			const arrayNode: ParsedNode = { element: 'array', children: [], attributes: {} };
			const container = currentContainer(state);

			if (!container) {
				return false;
			}

			if (container.type === 'object' && container.currentPair) {
				container.currentPair.children[1] = arrayNode;
				container.currentPair = null;
				container.expectingKey = true;
			} else if (container.type === 'array') {
				container.node.children.push(arrayNode);
				container.expectingValue = false;
			}

			state.stack.push({ node: arrayNode, type: 'array', expectingValue: true, currentPair: null });
			return false;
		}

		if (char === '}' || char === ']') {
			flushBuffer();
			state.stack.pop();
			return state.stack.length === 0;
		}

		if (char === ':' || char === ',') {
			flushBuffer();
			const container = currentContainer(state);
			if (!container) {
				return false;
			}

			if (char === ',' && container.type === 'object') {
				container.expectingKey = true;
			}

			if (char === ',' && container.type === 'array') {
				container.expectingValue = true;
			}

			return false;
		}

		if (!/\s/.test(char)) {
			state.buffer += char;
			const container = currentContainer(state);
			if (!container) {
				return false;
			}

			if (container.type === 'object' && container.currentPair) {
				container.currentPair.children[1] = buildPrimitiveNode(state.buffer);
			} else if (container.type === 'array') {
				const nextNode = buildPrimitiveNode(state.buffer);
				if (container.expectingValue) {
					container.node.children.push(nextNode);
					container.expectingValue = false;
				} else {
					const lastChild = container.node.children[container.node.children.length - 1];
					if (lastChild && typeof lastChild !== 'string' && lastChild.element === 'value') {
						lastChild.children = nextNode.children;
						lastChild.attributes = nextNode.attributes;
					} else {
						container.node.children.push(nextNode);
					}
				}
			}
		}

		return false;
	}
};
