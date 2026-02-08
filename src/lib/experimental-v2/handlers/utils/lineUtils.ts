import type { ParsedNode } from '../../types';

export const appendText = (node: ParsedNode, text: string): void => {
    if (!text) {
        return;
    }
    const last = node.children[node.children.length - 1];
    if (typeof last === 'string') {
        node.children[node.children.length - 1] = last + text;
        return;
    }
    node.children.push(text);
};
