import type { PatternHandler } from '../types';
import { blockquoteHandler } from './blockquoteHandler';
import { codeHandler } from './codeHandler';
import { emphasisHandler } from './emphasisHandler';
import { headingHandler } from './headingHandler';
import { horizontalRuleHandler } from './horizontalRuleHandler';
import { linkHandler } from './linkHandler';
import { orderedListHandler } from './orderedListHandler';
import { strongHandler } from './strongHandler';
import { tableHandler } from './tableHandler';
import { unorderedListHandler } from './unorderedListHandler';

export const experimentalHandlers: PatternHandler<any, any>[] = [
    headingHandler,
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
    emphasisHandler,
    headingHandler,
    horizontalRuleHandler,
    linkHandler,
    orderedListHandler,
    strongHandler,
    tableHandler,
    unorderedListHandler
};
