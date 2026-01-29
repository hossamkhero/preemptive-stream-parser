# Examples

These examples demonstrate how to use the streaming parser in real-world and
edge-case scenarios. Each example is self-contained and can be adapted into a
handler extension for your own use case.

- `markdown.ts`: markdown usage with a custom image handler extension.
- `json.ts`: a streaming JSON collector that tracks nested structure and emits
  nodes when objects/arrays close.
- `diagram.ts`: a diagram/graph DSL streamed from tokens, building nodes and
  edges on the fly.
