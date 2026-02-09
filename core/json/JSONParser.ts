import { jsonHandler } from './jsonHandler';
import { StreamParser, type StreamParserOptions } from '../engine/StreamParser';
import type { ParsedNode, PatternHandler as BasePatternHandler } from '../engine/types';

export type ParsedJSONNode = ParsedNode;
export type PatternHandler = BasePatternHandler<any, any>;

export class JSONParser extends StreamParser {
	constructor(patterns: PatternHandler[] = [], options: StreamParserOptions = {}) {
		const resolvedPatterns = patterns.length === 0 ? [jsonHandler] : patterns;
		super(resolvedPatterns, { rootElement: 'root', ...options });
	}
}
