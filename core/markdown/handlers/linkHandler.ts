import type { PatternHandler } from '../../engine/types';

type LinkSeed = {};

type LinkState = {
	phase: 'text' | 'between' | 'url';
	urlBuffer: string;
};

export const linkHandler: PatternHandler<LinkState, LinkSeed> = {
	elementName: 'a',
	allowedNestings: ['strong', 'em', 'code'],

	start(buffer: string) {
		if (!buffer.startsWith('[')) {
			return { kind: 'no' };
		}

		if (buffer.length === 1) {
			return { kind: 'potential' };
		}

		const firstLabelChar = buffer[1];
		if (/\s/.test(firstLabelChar)) {
			return { kind: 'no' };
		}

		return {
			kind: 'commit',
			seed: {},
			consumed: 1
		};
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

			if (char === '\n') {
				control.preventConsume();
				return true;
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

			control.preventConsume();
			return true;
		}

		if (char === ')') {
			writer.setAttr('href', state.urlBuffer);
			return true;
		}

		if (char === '\n') {
			control.preventConsume();
			return true;
		}

		state.urlBuffer += char;
		return false;
	}
};
