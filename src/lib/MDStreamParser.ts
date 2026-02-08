import { markdownHandlers } from './handlers';
import { StreamParser, type StreamParserOptions } from './StreamParser';
import type { ParsedNode, PatternHandler as BasePatternHandler } from './types';

export type ParsedMDNode = ParsedNode;
export type PatternHandler = BasePatternHandler;

export class MarkdownStreamParser extends StreamParser {
	constructor(patterns: PatternHandler[] = [], options: StreamParserOptions = {}) {
		const resolvedPatterns = patterns.length === 0 ? markdownHandlers : patterns;
		super(resolvedPatterns, { rootElement: 'root', ...options });
	}
}
