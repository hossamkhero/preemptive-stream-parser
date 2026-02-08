import type { PatternHandler } from '../types';

type LinkSeed = {
	initialChar: string;
};

type LinkState = {
	phase: 'text' | 'between' | 'url';
	urlBuffer: string;
};

export const linkHandler: PatternHandler<LinkState, LinkSeed> = {
	elementName: 'a',
	allowedNestings: ['strong', 'em', 'code'],

	start(buffer: string) {
		if (buffer.endsWith('[')) {
			return { kind: 'potential' };
		}
		if (/\[[^\s]$/.test(buffer)) {
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
		return {
			phase: 'text',
			urlBuffer: ''
		};
	},

	step(ctx) {
		const { char, state, writer, control } = ctx;

		if (state.phase === 'text') {
			if (char === ']') {
				state.phase = 'between';
				return false;
			}

			if (char === '*' || char === '_' || char === '`') {
				control.preventConsume();
				return false;
			}

			writer.text(char);
			return false;
		}

		if (state.phase === 'between') {
			if (char === '(') {
				state.phase = 'url';
				return false;
			}
			return true;
		}

		if (char === ')') {
			writer.setAttr('href', state.urlBuffer);
			return true;
		}

		state.urlBuffer += char;
		return false;
	}
};

