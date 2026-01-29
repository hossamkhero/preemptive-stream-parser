# MD Stream Parser

A streaming markdown parser library that handles tokens "preemptively" - parsing character-by-character in real-time.

## Quick Start

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Run tests
bun test

# Run tests in watch mode
bun test --watch
```

## Project Structure

```
src/
├── lib/                    # Core library
│   ├── MDStreamParser.ts   # Main parser class
│   ├── handlers.ts         # Markdown pattern handlers
│   ├── index.ts           # Library exports
│   └── __tests__/         # Unit tests
│       └── MDStreamParser.test.ts
├── components/
│   ├── TestPlayground.tsx  # Interactive test UI
│   └── MarkdownRenderer.tsx # React renderer
├── App.tsx                 # Main app
├── main.tsx               # Entry point
└── index.css              # Styles (Tailwind v4)
examples/
├── README.md              # Example index
├── markdown.ts            # Markdown + image extension example
├── json.ts                # Streaming JSON parser example
└── diagram.ts             # Diagram/graph DSL example
```

## Library Usage

```typescript
import { MarkdownStreamParser } from './lib'

const parser = new MarkdownStreamParser()

// One-shot parsing
const result = parser.parse('# Hello **World**')

// Or stream character-by-character
for (const char of markdown) {
  parser.parse(char)
}

console.log(parser.root) // Parsed AST
```

## General Stream Parser API

If you want a non-Markdown stream parser, the core engine is now exposed as
`StreamParser`. Provide your own pattern handlers and it will stream into the
same AST shape.

```typescript
import { StreamParser, type PatternHandler } from './lib'

const shoutHandler: PatternHandler = {
  name: 'shout',
  elementName: 'shout',
  start: (buffer) => (buffer.endsWith('!!') ? 'commit' : 'no'),
  prefixLength: () => 2,
  commit: () => '',
  feed: (char, node, parser) => {
    if (char === '!') return true
    parser.addTextToNode(node, char)
    return false
  }
}

const parser = new StreamParser([shoutHandler])
parser.parse('hello!!wow!')
```

## Extending Markdown (DX-Friendly)

Use the extension helpers to insert/replace handlers without rewriting the
entire handler list.

```typescript
import {
  createMarkdownParser,
  type HandlerExtension,
  type PatternHandler
} from './lib'

const imageHandler: PatternHandler = {
  name: 'image',
  elementName: 'img',
  allowedNestings: [],
  start: (buffer) => {
    if (buffer.endsWith('![')) return 'potential'
    if (buffer.match(/!\[[^\s]$/)) return 'commit'
    return 'no'
  },
  prefixLength: () => 3, // "![a" => opener + first content char
  commit: (buffer) => buffer[buffer.length - 1] ?? '',
  feed: (char, node) => {
    if (!node.attributes[0]) {
      node.attributes[0] = { phase: 'alt', buffer: '' }
    }
    const state = node.attributes[0]
    if (state.phase === 'alt') {
      if (char === ']') {
        state.phase = 'between'
      } else {
        node.children.push(char)
      }
      return false
    }
    if (state.phase === 'between') {
      if (char === '(') state.phase = 'src'
      return false
    }
    if (state.phase === 'src') {
      if (char === ')') {
        node.attributes[0] = { src: state.buffer }
        return true
      }
      state.buffer += char
    }
    return false
  }
}

const imageExtension: HandlerExtension = {
  name: 'images',
  handlers: [imageHandler],
  placement: { before: 'a' }
}

const parser = createMarkdownParser([imageExtension])
parser.parse('Hello ![Alt](https://example.com/x.png) world')
```

## Extending the Parser (Developer + LLM Friendly)

When adding a new pattern handler:
1. Decide the **trigger** (`start`) and whether it’s a `potential` or a `commit`.
2. Implement `prefixLength` so the parser can flush text *before* the pattern.
3. Use `commit` to seed the node with the first content char if needed.
4. Implement `feed` to stream content and return `true` to close the node.
5. Add `allowedNestings` to keep inline/block mixing safe.

For a detailed LLM-focused authoring guide, see
[`docs/LLM_GUIDE.md`](docs/LLM_GUIDE.md).

## Examples

See [`examples/`](examples/) for three edge-case examples (Markdown + images,
streaming JSON, and a diagram/graph DSL).

## Test Playground

The UI at http://localhost:5173 provides:
- **Streaming Simulation**: Simulate token-by-token parsing with speed control
- **Live Preview**: See rendered markdown output in real-time
- **AST Viewer**: Inspect the parsed Abstract Syntax Tree
- **Test Cases**: Save, load, and export test cases as JSON

## Running Tests

```bash
# Run all tests
bun test

# Watch mode
bun test --watch
```

## Tech Stack

- **Runtime**: Bun
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4 (with `@tailwindcss/vite` plugin)
- **Testing**: Bun's built-in test runner (`bun:test`)
- **Language**: TypeScript
