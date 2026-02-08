import type { PatternHandler } from '../types';

type CodeSeed = {
	initialChar: string;
};

type CodeState = {};

export const codeHandler: PatternHandler<CodeState, CodeSeed> = {
	elementName: 'code',
	allowedNestings: [],

	start(buffer: string) {
		if (buffer.endsWith('`')) {
			return { kind: 'potential' };
		}
		if (/`[^\s]$/.test(buffer)) {
			const initialChar = buffer[buffer.length - 1];
			return {
				kind: 'commit',
				seed: { initialChar },
				initialText: initialChar,
				consumed: 2
			};
		}
		return { kind: 'no' };
	},

	createState() {
		return {};
	},

	step(ctx) {
		const { char, writer } = ctx;
		if (char === '`') {
			return true;
		}
		writer.text(char);
		return false;
	}
};

