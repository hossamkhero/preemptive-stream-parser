import type { ParsedNode, PatternHandler } from '../types';

type TableSeed = {};

type TableState = {
	isConfirmed: boolean;
	rowBuffer: string;
	currentRow: ParsedNode | null;
	currentCell: ParsedNode | null;
	afterPipe: boolean;
};

const INLINE_ALLOWED = ['strong', 'em', 'code', 'a'];

const createRow = (): ParsedNode => ({
	element: 'tr',
	children: [{ element: 'td', children: [''], attributes: {} }],
	attributes: {}
});

const createCell = (): ParsedNode => ({
	element: 'td',
	children: [''],
	attributes: {}
});

export const tableHandler: PatternHandler<TableState, TableSeed> = {
	elementName: 'table',
	allowedNestings: INLINE_ALLOWED,

	start(buffer: string, context) {
		if (!context.lineStart) {
			return { kind: 'no' };
		}
		if (buffer === '|') {
			return { kind: 'commit', seed: {}, consumed: 1 };
		}
		return { kind: 'no' };
	},

	createState() {
		return {
			isConfirmed: false,
			rowBuffer: '|',
			currentRow: null,
			currentCell: null,
			afterPipe: true
		};
	},

	step(ctx) {
		const { char, node, state, control } = ctx;

		const processChar = (inputChar: string): void => {
			const row = state.currentRow as ParsedNode;

			if (inputChar === '|') {
				const currentCell = state.currentCell as ParsedNode;
				const currentText = (currentCell.children[0] as string | undefined) ?? '';
				const cellText = currentText.trim();

				if (state.afterPipe && !cellText) {
					state.afterPipe = false;
					return;
				}

				currentCell.children[0] = cellText;

				const nextCell = createCell();
				row.children.push(nextCell);
				state.currentCell = nextCell;
				state.afterPipe = true;
				return;
			}

			const currentCell = state.currentCell as ParsedNode;
			const currentText = (currentCell.children[0] as string | undefined) ?? '';
			currentCell.children[0] = currentText + inputChar;
			state.afterPipe = false;
		};

		// A new table row must start with '|'. If the next line starts with anything else,
		// close this table and let the parent/parser handle that character.
		if (!state.isConfirmed && state.rowBuffer.length === 0 && char !== '|') {
			control.preventConsume();
			return true;
		}

		if (char === '\n') {
			if (!state.isConfirmed) {
				const isPotentialSeparator = /^[\s|:-]*$/.test(state.rowBuffer);
				const isValidSeparator = /^\|\s*[-:]+\s*(\|\s*[-:]+\s*)*\|?$/.test(state.rowBuffer.trim());

				if (isPotentialSeparator || isValidSeparator) {
					state.isConfirmed = false;
					state.rowBuffer = '';
					state.currentRow = null;
					state.currentCell = null;
					state.afterPipe = true;
					return false;
				}

				const row = createRow();
				node.children.push(row);
				state.currentRow = row;
				state.currentCell = row.children[0] as ParsedNode;
				state.isConfirmed = true;

				for (const bufferedChar of state.rowBuffer) {
					processChar(bufferedChar);
				}
			}

			if (state.currentRow) {
				state.currentRow.children = state.currentRow.children.filter((child) => {
					if (typeof child === 'string') {
						return true;
					}
					return child.children.join('').trim().length > 0;
				});
			}

			state.isConfirmed = false;
			state.rowBuffer = '';
			state.currentRow = null;
			state.currentCell = null;
			state.afterPipe = true;
			return false;
		}

		if (!state.isConfirmed) {
			state.rowBuffer += char;

			const isSeparatorChar = /[|\-:\s]/.test(char);
			if (!isSeparatorChar) {
				const row = createRow();
				node.children.push(row);
				state.currentRow = row;
				state.currentCell = row.children[0] as ParsedNode;
				state.isConfirmed = true;
				state.afterPipe = true;

				for (const bufferedChar of state.rowBuffer) {
					processChar(bufferedChar);
				}
			}
			return false;
		}

		processChar(char);
		return false;
	}
};
