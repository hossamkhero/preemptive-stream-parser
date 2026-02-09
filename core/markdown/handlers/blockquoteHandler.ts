import type { PatternHandler } from '../../engine/types';
import {
	startAtLineStart,
	stepLineTextWithInlineHandoff
} from './utils/lineBlockUtils';

type BlockquoteSeed = {};
type BlockquoteState = {};

const INLINE_ALLOWED = ['strong', 'em', 'code', 'a'];

export const blockquoteHandler: PatternHandler<BlockquoteState, BlockquoteSeed> = {
	elementName: 'blockquote',
	allowedNestings: INLINE_ALLOWED,

	start(buffer: string, context) {
		return startAtLineStart<BlockquoteSeed>(context, () => {
			if (buffer.endsWith('>')) {
				return { kind: 'potential' };
			}
			if (buffer.endsWith('> ')) {
				return { kind: 'commit', seed: {}, consumed: 2 };
			}
			return { kind: 'no' };
		});
	},

	createState() {
		return {};
	},

	step: stepLineTextWithInlineHandoff
};
