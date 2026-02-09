FSM-based preemptive streaming parser engine, where tokens stay pending until input confirms structure before commit. Includes Markdown and JSON parser implementations. 
Intended to be copied and extended directly in-repo.

### Structure 

- `core/` = parser source + handlers + tests
- `studio/` = React playground for visual testing

### Quick Start

```bash
# install deps
bun install

# run studio UI
bun run dev

# run parser tests
bun test
```

### Install In Your Repo

From any project, install parsers directly with one command:

```bash
# markdown + engine
curl -fsSL https://raw.githubusercontent.com/hossamkhero/preemptive-stream-parser/refs/heads/master/scripts/install-md.sh | bash
```

```bash
# json + engine
curl -fsSL https://raw.githubusercontent.com/hossamkhero/preemptive-stream-parser/refs/heads/master/scripts/install-json.sh | bash
```

```bash
# markdown + json + engine
curl -fsSL https://raw.githubusercontent.com/hossamkhero/preemptive-stream-parser/refs/heads/master/scripts/install.sh | bash
```

Optional flags:

```bash
curl -fsSL https://raw.githubusercontent.com/hossamkhero/preemptive-stream-parser/refs/heads/master/scripts/install-md.sh | bash -s -- --to src/stream-parser --with-tests
```

### Core Usage

```ts
import { MarkdownStreamParser } from './core'

const parser = new MarkdownStreamParser()

// one-shot
parser.parse('# Hello **World**')

// streaming
for (const ch of '# Hello **World**') {
  parser.parse(ch)
}

// parser.root is the AST
console.log(parser.root)
// {
//   element: 'root',
//   children: [
//     {
//       element: 'h1',
//       children: ['Hello ', { element: 'strong', children: ['World'], attributes: {} }],
//       attributes: {}
//     }
//   ],
//   attributes: {}
// }
```

### Generic Engine Usage

```ts
import { StreamParser, type PatternHandler } from './core'

const shoutHandler: PatternHandler<{}, undefined> = {
  elementName: 'shout',
  allowedNestings: [],
  start: (buffer) => {
    if ('!!'.startsWith(buffer)) {
      if (buffer === '!!') return { kind: 'commit', seed: undefined, consumed: 2 }
      return { kind: 'potential' }
    }
    return { kind: 'no' }
  },
  createState: () => ({}),
  step: ({ char, writer }) => {
    if (char === '!') return true
    writer.text(char)
    return false
  }
}

const parser = new StreamParser([shoutHandler])
parser.parse('hello!!world!')
console.log(parser.root)
// {
//   element: 'root',
//   children: ['hello', { element: 'shout', children: ['world'], attributes: {} }],
//   attributes: {}
// }
```
