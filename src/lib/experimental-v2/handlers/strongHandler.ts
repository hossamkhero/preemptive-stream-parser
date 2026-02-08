import type { PatternHandler } from '../types';

type StrongSeed = {
	opener: '*' | '_';
	initialChar: string;
};

type StrongState = {
	opener: '*' | '_';
	pendingCloser: boolean;
	lastChar: string;
};

const INLINE_ALLOWED = ['strong', 'em', 'code', 'a'];

export const strongHandler: PatternHandler<StrongState, StrongSeed> = {
	elementName: 'strong',
	allowedNestings: INLINE_ALLOWED,

	start(buffer: string) {
		if (buffer.endsWith('*')) {
			return { kind: 'potential' };
		}

		const strongAsterisk = /\*\*[^*\s]$/.test(buffer);
		if (strongAsterisk) {
			const initialChar = buffer[buffer.length - 1];
			return {
				kind: 'commit',
				seed: { opener: '*', initialChar },
				initialText: initialChar,
				consumed: 3
			};
		}

		if (buffer === '_' || buffer === '__') {
			return { kind: 'potential' };
		}

		const strongUnderscore = /__[^_\s]$/.test(buffer);
		if (strongUnderscore) {
			const initialChar = buffer[buffer.length - 1];
			return {
				kind: 'commit',
				seed: { opener: '_', initialChar },
				initialText: initialChar,
				consumed: 3
			};
		}

		return { kind: 'no' };
	},

	createState(seed) {
		return {
			opener: seed.opener,
			pendingCloser: false,
			lastChar: seed.initialChar
		};
	},

	step(ctx) {
		const { char, state, writer, control } = ctx;

		if (char === state.opener) {
			if (state.pendingCloser) {
				if (
					state.opener === '*' ||
					(state.lastChar !== '' && state.lastChar !== ' ' && state.lastChar !== '_')
				) {
					state.pendingCloser = false;
					return true;
				}

				writer.text(state.opener + state.opener);
				state.lastChar = state.opener;
				state.pendingCloser = false;
				return false;
			}

			state.pendingCloser = true;
			return false;
		}

		if (state.pendingCloser) {
			writer.text(state.opener);
			state.lastChar = state.opener;
			state.pendingCloser = false;
		}

		if (char === '*' || char === '_' || char === '`' || char === '[') {
			control.preventConsume();
			return false;
		}

		writer.text(char);
		state.lastChar = char;
		return false;
	},

	onFinalize(ctx) {
		const { state, writer } = ctx;
		if (state.pendingCloser) {
			writer.text(state.opener);
			state.pendingCloser = false;
		}
	}
};
