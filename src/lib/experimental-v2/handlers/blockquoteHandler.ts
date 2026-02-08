import type { PatternHandler } from '../types';

type BlockquoteSeed = {};
type BlockquoteState = {};

const INLINE_ALLOWED = ['strong', 'em', 'code', 'a'];

export const blockquoteHandler: PatternHandler<BlockquoteState, BlockquoteSeed> = {
	elementName: 'blockquote',
	allowedNestings: INLINE_ALLOWED,

	start(buffer: string, context) {
		if (!context.lineStart) {
			return { kind: 'no' };
		}
		if (buffer.endsWith('>')) {
			return { kind: 'potential' };
		}
		if (buffer.endsWith('> ')) {
			return { kind: 'commit', seed: {}, consumed: 2 };
		}
		return { kind: 'no' };
	},

	createState() {
		return {};
	},

	step(ctx) {
		const { char, writer, control } = ctx;

		if (char === '\n') {
			control.preventConsume();
			return true;
		}

		if (char === '*' || char === '_' || char === '`' || char === '[') {
			control.preventConsume();
			return false;
		}

		writer.text(char);
		return false;
	}
};

