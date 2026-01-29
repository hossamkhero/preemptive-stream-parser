# LLM Authoring Guide: Stream Parser Patterns

This project exposes a generic `StreamParser` plus Markdown-specific handlers.
If you are an LLM adding new syntax, use this guide to produce correct, safe
handlers that stream character-by-character.

## Mental Model

- **Start**: decides if a buffer is *not relevant*, *potential*, or *commit*.
- **Commit**: creates a new node and optionally seeds the node with the first
  character of content.
- **Feed**: streams subsequent characters into the active node; return `true`
  when the node should close.
- **Upgrade**: optional cleanup hook to finalize or normalize a node when it
  closes (or on `finalize`).

## Required Implementation Steps

1. **Name + elementName**
   - `name` is the unique handler id.
   - `elementName` is the node type in the AST.

2. **`start(buffer, parser)`**
   - Return `"potential"` when the buffer *could* be the opening token.
   - Return `"commit"` only when the buffer is *definitely* the opening token.
   - Return `"no"` otherwise.

3. **`prefixLength(buffer)`**
   - Return the length of the opening token plus the **first content character**.
   - The parser uses this to flush text before the pattern.

4. **`commit(buffer, parser)`**
   - Return a string to seed the new node with initial content.
   - Usually this is the last character in the buffer.

5. **`feed(char, node, parser)`**
   - Stream the character into the node’s text/children.
   - Return `true` when you encounter a closing delimiter.

6. **`allowedNestings`**
   - `undefined` → allow all nestings.
   - `[]` → disallow all nested handlers.
   - `["handler_a", "handler_b"]` → allow only these handlers.

## Example Template

```ts
import type { PatternHandler } from './lib'

export const customHandler: PatternHandler = {
  name: 'custom',
  elementName: 'custom',
  allowedNestings: [],
  start: (buffer) => {
    if (buffer.endsWith('@@')) return 'commit'
    if (buffer.endsWith('@')) return 'potential'
    return 'no'
  },
  prefixLength: () => 2,
  commit: () => '',
  feed: (char, node, parser) => {
    if (char === '@') return true
    parser.addTextToNode(node, char)
    return false
  }
}
```

## LLM Checklist

- [ ] Did you choose a unique `name`?
- [ ] Did you implement `prefixLength` so text flushes properly?
- [ ] Did you seed the node correctly in `commit`?
- [ ] Does `feed` return `true` at the right closing delimiter?
- [ ] Are nesting rules explicit and safe?
- [ ] Did you add tests for at least one streaming scenario?

## Handler Extensions (Recommended DX)

Use `composeHandlers` or `createMarkdownParser` to add new behavior without
rewriting the entire handler list. This lets you insert a handler before/after
another handler or replace an existing handler by name.

```ts
import { createMarkdownParser, type HandlerExtension } from './lib'

const extension: HandlerExtension = {
  name: 'images',
  handlers: [imageHandler],
  placement: { before: 'a' }
}

const parser = createMarkdownParser([extension])
```

## Common Pitfalls

- **Forgetting `prefixLength`**: causes text loss or duplication.
- **Committing too early**: pattern opens on ambiguous buffer.
- **No `allowedNestings`**: leads to unexpected inline/block mixing.
- **No streaming test**: hides issues with char-by-char parsing.
