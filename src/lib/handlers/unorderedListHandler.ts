import type { PatternHandler } from '../types';
import { appendText } from './utils/lineUtils';
import {
	createListItem,
	getCurrentListItem,
	getLastListInParent,
	isInsideListElement
} from './utils/listUtils';

type UnorderedListSeed = {};

type UnorderedListState = {
	waitingForListItem: boolean;
	markerBuffer: string;
};

const INLINE_ALLOWED = ['strong', 'em', 'code', 'a'];

export const unorderedListHandler: PatternHandler<UnorderedListState, UnorderedListSeed> = {
	elementName: 'ul',
	allowedNestings: INLINE_ALLOWED,

	start(buffer: string, context) {
		if (!context.lineStart) {
			return { kind: 'no' };
		}

		if (isInsideListElement(context.currentNode)) {
			return { kind: 'no' };
		}

		if (getLastListInParent(context.currentNode)) {
			return { kind: 'no' };
		}

		if (/^[ \t]*[-*+]$/.test(buffer)) {
			return { kind: 'potential' };
		}
		if (/^[ \t]*[-*+]\s$/.test(buffer)) {
			return { kind: 'commit', seed: {}, consumed: buffer.length };
		}

		return { kind: 'no' };
	},

	createState(_seed, _parser, node) {
		createListItem(node);
		return {
			waitingForListItem: false,
			markerBuffer: ''
		};
	},

	step(ctx) {
		const { char, node, state, control } = ctx;
		let currentListItem = getCurrentListItem(node);

		if (char === '\n') {
			if (state.waitingForListItem) {
				state.waitingForListItem = false;
				control.preventConsume();
				return true;
			}

			state.waitingForListItem = true;
			state.markerBuffer = '';
			return false;
		}

		if (state.waitingForListItem) {
			state.markerBuffer += char;

			const isUnorderedMarker = /^[ \t]*[-*+]$/.test(state.markerBuffer);
			const isUnorderedComplete = /^[ \t]*[-*+] $/.test(state.markerBuffer);
			const isOrderedMarker = /^[ \t]*\d+\.?$/.test(state.markerBuffer);
			const isOrderedComplete = /^[ \t]*\d+\. $/.test(state.markerBuffer);
			const couldBeContinuation = /^[ \t]*$/.test(state.markerBuffer);

			if (isUnorderedComplete || isOrderedComplete) {
				currentListItem = createListItem(node);
				state.waitingForListItem = false;
				state.markerBuffer = '';
				return false;
			}

			if (
				isUnorderedMarker ||
				isOrderedMarker ||
				couldBeContinuation ||
				char === ' ' ||
				char === '\t'
			) {
				return false;
			}

			state.waitingForListItem = false;
			control.preventConsume();
			return true;
		}

		appendText(currentListItem, char);
		return false;
	}
};
