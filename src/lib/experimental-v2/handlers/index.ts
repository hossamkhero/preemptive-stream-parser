import type { PatternHandler } from '../types';
import { blockquoteHandler } from './blockquoteHandler';
import { codeHandler } from './codeHandler';
import { emphasisHandler } from './emphasisHandler';
import { createHeadingHandler, headingHandlers } from './headingHandler';
import { horizontalRuleHandler } from './horizontalRuleHandler';
import { linkHandler } from './linkHandler';
import { orderedListHandler } from './orderedListHandler';
import { strongHandler } from './strongHandler';
import { tableHandler } from './tableHandler';
import { unorderedListHandler } from './unorderedListHandler';

export const experimentalHandlers: PatternHandler<any, any>[] = [
    ...headingHandlers,
    strongHandler,
    emphasisHandler,
    codeHandler,
    linkHandler,
    unorderedListHandler,
    orderedListHandler,
    blockquoteHandler,
    tableHandler,
    horizontalRuleHandler
];

export {
    blockquoteHandler,
    codeHandler,
    createHeadingHandler,
    emphasisHandler,
    headingHandlers,
    horizontalRuleHandler,
    linkHandler,
    orderedListHandler,
    strongHandler,
    tableHandler,
    unorderedListHandler
};
