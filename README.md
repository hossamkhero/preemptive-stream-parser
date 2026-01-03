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
