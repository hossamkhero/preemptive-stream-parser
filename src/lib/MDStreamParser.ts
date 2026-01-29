import { defaultHandlers } from './handlers';
import { StreamParser, type ParsedNode, type PatternHandler as BasePatternHandler } from './StreamParser';

export type ParsedMDNode = ParsedNode;
export type PatternHandler = BasePatternHandler;

export class MarkdownStreamParser extends StreamParser {
    constructor(patterns: PatternHandler[] = []) {
        const resolvedPatterns = patterns.length === 0 ? defaultHandlers : patterns;
        super(resolvedPatterns, { rootElement: 'root' });
    }
}
