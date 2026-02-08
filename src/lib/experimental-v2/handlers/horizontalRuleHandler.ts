import type { PatternHandler } from '../types';

type HorizontalRuleSeed = {};
type HorizontalRuleState = {};

export const horizontalRuleHandler: PatternHandler<HorizontalRuleState, HorizontalRuleSeed> = {
	elementName: 'hr',
	allowedNestings: [],

	start(buffer: string, context) {
		if (!context.lineStart) {
			return { kind: 'no' };
		}

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
	},

	createState() {
		return {};
	},

	step(ctx) {
		ctx.control.preventConsume();
		return true;
	}
};

