import type { PatternHandler } from '../types';

type HeadingSeed = {};
type HeadingState = {};

const INLINE_ALLOWED = ['strong', 'em', 'code', 'a'];

export const createHeadingHandler = (level: number): PatternHandler<HeadingState, HeadingSeed> => {
	const prefix = '#'.repeat(level);

	return {
		elementName: `h${level}`,
		allowedNestings: INLINE_ALLOWED,

		start(buffer: string, context) {
			if (!context.lineStart) {
				return { kind: 'no' };
			}

			if (buffer === prefix) {
				return { kind: 'potential' };
			}
			if (buffer === `${prefix} `) {
				return { kind: 'commit', seed: {}, consumed: prefix.length + 1 };
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
};

export const headingHandlers: PatternHandler<any, any>[] = Array.from(
	{ length: 6 },
	(_, index) => createHeadingHandler(index + 1)
);

