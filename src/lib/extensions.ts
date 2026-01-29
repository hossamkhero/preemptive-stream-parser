import { MarkdownStreamParser } from './MDStreamParser'
import { defaultHandlers } from './handlers'
import { StreamParser, type PatternHandler, type StreamParserOptions } from './StreamParser'

export interface HandlerPlacement {
    before?: string
    after?: string
    atStart?: boolean
    atEnd?: boolean
}

export interface HandlerExtension {
    name: string
    handlers: PatternHandler[]
    placement?: HandlerPlacement
    replaceExisting?: boolean
}

const withoutOverlaps = (handlers: PatternHandler[], additions: PatternHandler[]) => {
    const names = new Set(additions.map((handler) => handler.name))
    return handlers.filter((handler) => !names.has(handler.name))
}

const resolveInsertionIndex = (handlers: PatternHandler[], placement?: HandlerPlacement) => {
    if (placement?.atStart) return 0
    if (placement?.before) {
        const index = handlers.findIndex((handler) => handler.name === placement.before)
        return index === -1 ? handlers.length : index
    }
    if (placement?.after) {
        const index = handlers.findIndex((handler) => handler.name === placement.after)
        return index === -1 ? handlers.length : index + 1
    }
    return handlers.length
}

export const composeHandlers = (baseHandlers: PatternHandler[], extensions: HandlerExtension[] = []) => {
    let handlers = [...baseHandlers]

    for (const extension of extensions) {
        const nextHandlers = extension.replaceExisting
            ? withoutOverlaps(handlers, extension.handlers)
            : handlers

        const insertionIndex = resolveInsertionIndex(nextHandlers, extension.placement)
        handlers = [
            ...nextHandlers.slice(0, insertionIndex),
            ...extension.handlers,
            ...nextHandlers.slice(insertionIndex)
        ]
    }

    return handlers
}

export const createMarkdownParser = (extensions: HandlerExtension[] = []) => {
    const handlers = composeHandlers(defaultHandlers, extensions)
    return new MarkdownStreamParser(handlers)
}

export const createStreamParser = (
    baseHandlers: PatternHandler[],
    extensions: HandlerExtension[] = [],
    options: StreamParserOptions = {}
) => {
    const handlers = composeHandlers(baseHandlers, extensions)
    return new StreamParser(handlers, options)
}
