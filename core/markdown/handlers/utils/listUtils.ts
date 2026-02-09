import type { ParsedNode } from '../../../engine/types';

export const isInsideListElement = (node: ParsedNode): boolean =>
	node.element === 'ul' || node.element === 'ol';

export const getLastListInParent = (node: ParsedNode): ParsedNode | null => {
	if (isInsideListElement(node)) {
		return node;
	}

	if (node.children.length > 0) {
		const lastChild = node.children[node.children.length - 1];
		if (typeof lastChild !== 'string' && isInsideListElement(lastChild)) {
			return lastChild;
		}
	}

	return null;
};

export const createListItem = (listNode: ParsedNode): ParsedNode => {
	const listItem: ParsedNode = {
		element: 'li',
		children: [],
		attributes: {}
	};
	listNode.children.push(listItem);
	return listItem;
};

export const getCurrentListItem = (listNode: ParsedNode): ParsedNode => {
	for (let index = listNode.children.length - 1; index >= 0; index -= 1) {
		const child = listNode.children[index];
		if (typeof child !== 'string' && child.element === 'li') {
			return child;
		}
	}
	return createListItem(listNode);
};
