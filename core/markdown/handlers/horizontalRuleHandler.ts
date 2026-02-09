import type { PatternHandler } from '../../engine/types';
import { startAtLineStart, stepCloseWithoutConsume } from './utils/lineBlockUtils';

type HorizontalRuleSeed = {};
type HorizontalRuleState = {};

export const horizontalRuleHandler: PatternHandler<HorizontalRuleState, HorizontalRuleSeed> = {
	elementName: 'hr',
	allowedNestings: [],

	start(buffer: string, context) {
		return startAtLineStart<HorizontalRuleSeed>(context, () => {
			if (buffer.endsWith('-') || buffer.endsWith('*') || buffer.endsWith('_')) {
				return { kind: 'potential' };
			}
			if (buffer.endsWith('--') || buffer.endsWith('**') || buffer.endsWith('__')) {
				return { kind: 'potential' };
			}
			if (buffer.endsWith('---') || buffer.endsWith('***') || buffer.endsWith('___')) {
				return { kind: 'potential' };
			}
			if (buffer.endsWith('---\n') || buffer.endsWith('***\n') || buffer.endsWith('___\n')) {
				return { kind: 'commit', seed: {}, consumed: 4 };
			}

			return { kind: 'no' };
		});
	},

	createState() {
		return {};
	},

	step: stepCloseWithoutConsume
};
