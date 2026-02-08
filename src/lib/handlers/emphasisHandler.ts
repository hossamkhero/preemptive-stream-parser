import type { PatternHandler } from '../types';

type EmphasisSeed = {
	opener: '*' | '_';
	initialChar: string;
};

type EmphasisState = {
	opener: '*' | '_';
	lastChar: string;
};

const INLINE_ALLOWED = ['strong', 'em', 'code', 'a'];

export const emphasisHandler: PatternHandler<EmphasisState, EmphasisSeed> = {
	elementName: 'em',
	allowedNestings: INLINE_ALLOWED,

	start(buffer: string) {
		if (buffer.endsWith('*')) {
			return { kind: 'potential' };
		}
		if (/\*[^*\s]$/.test(buffer)) {
			const initialChar = buffer[buffer.length - 1];
			return {
				kind: 'commit',
				seed: { opener: '*', initialChar },
				initialText: initialChar,
				consumed: 2
			};
		}

		if (buffer.endsWith('_')) {
			return { kind: 'potential' };
		}
		if (/_[^_\s]$/.test(buffer)) {
			const initialChar = buffer[buffer.length - 1];
			return {
				kind: 'commit',
				seed: { opener: '_', initialChar },
				initialText: initialChar,
				consumed: 2
			};
		}

		return { kind: 'no' };
	},

	createState(seed) {
		return {
			opener: seed.opener,
			lastChar: seed.initialChar
		};
	},

	step(ctx) {
		const { char, state, writer, control } = ctx;

		if (char === state.opener) {
			if (state.lastChar !== '' && state.lastChar !== ' ' && state.lastChar !== state.opener) {
				return true;
			}

			writer.text(char);
			state.lastChar = char;
			return false;
		}

		if (char === '*' || char === '_' || char === '`' || char === '[') {
			control.preventConsume();
			return false;
		}

		writer.text(char);
		state.lastChar = char;
		return false;
	}
};

