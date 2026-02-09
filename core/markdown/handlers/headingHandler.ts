import type { PatternHandler } from '../../engine/types';
import {
	startAtLineStart,
	stepLineTextWithInlineHandoff
} from './utils/lineBlockUtils';

type HeadingSeed = {
	level: number;
};
type HeadingState = {};

const INLINE_ALLOWED = ['strong', 'em', 'code', 'a'];

export const headingHandler: PatternHandler<HeadingState, HeadingSeed> = {
	elementName: 'heading',
	allowedNestings: INLINE_ALLOWED,

	start(buffer: string, context) {
		return startAtLineStart<HeadingSeed>(context, () => {
			if (/^#{1,6}$/.test(buffer)) {
				return { kind: 'potential' };
			}

			const match = /^(#{1,6}) $/.exec(buffer);
			if (!match) {
				return { kind: 'no' };
			}

			return {
				kind: 'commit',
				seed: { level: match[1].length },
				consumed: match[1].length + 1
			};
		});
	},

	createState(seed, _parser, node) {
		node.element = `h${seed.level}`;
		return {};
	},

	step: stepLineTextWithInlineHandoff
};
