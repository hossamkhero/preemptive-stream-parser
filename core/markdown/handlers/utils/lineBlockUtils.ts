import type { StartContext, StartResult, StepContext } from '../../../engine/types';

const inlineHandoffChars = new Set(['*', '_', '`', '[']);

export const startAtLineStart = <Seed>(
	context: StartContext,
	computeStart: () => StartResult<Seed>
): StartResult<Seed> => {
	if (!context.lineStart) {
		return { kind: 'no' };
	}
	return computeStart();
};

export const stepLineTextWithInlineHandoff = <State>(ctx: StepContext<State>): boolean => {
	const { char, writer, control } = ctx;

	if (char === '\n') {
		control.preventConsume();
		return true;
	}

	if (inlineHandoffChars.has(char)) {
		control.preventConsume();
		return false;
	}

	writer.text(char);
	return false;
};

export const stepCloseWithoutConsume = <State>(ctx: StepContext<State>): boolean => {
	ctx.control.preventConsume();
	return true;
};
