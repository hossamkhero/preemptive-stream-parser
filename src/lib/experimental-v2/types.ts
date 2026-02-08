import type { StreamParser } from './StreamParser';

export interface ParsedNode {
    element: string;
    children: Array<ParsedNode | string>;
    attributes: Record<string, unknown>;
}

export interface Writer {
    text(s: string): void;
    setAttr(key: string, value: unknown): void;
}

export interface StepControl {
    preventConsume(): void;
}

export interface StartContext {
    lineStart: boolean;
    currentNode: ParsedNode;
}

export type StartResult<Seed = void> =
    | { kind: 'no' }
    | { kind: 'potential' }
    | { kind: 'commit'; seed: Seed; initialText?: string; consumed?: number };

export type StepResult = boolean;

export interface StepContext<State> {
    char: string;
    node: ParsedNode;
    parser: StreamParser;
    writer: Writer;
    state: State;
    control: StepControl;
}

export interface FinalizeContext<State> {
    node: ParsedNode;
    parser: StreamParser;
    writer: Writer;
    state: State;
}

export interface PatternHandler<State = unknown, Seed = void> {
    elementName: string;
    allowedNestings?: string[] | null;
    start(buffer: string, context: StartContext): StartResult<Seed>;
    createState(seed: Seed, parser: StreamParser, node: ParsedNode): State;
    step(context: StepContext<State>): StepResult;
    onFinalize?(context: FinalizeContext<State>): void;
}
