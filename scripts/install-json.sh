#!/usr/bin/env bash
set -euo pipefail

MODE="json"
SCRIPT_NAME="install-json.sh"
DEFAULT_REPO="hossamkhero/preemptive-stream-parser"
REPO="${STREAMING_MD_REPO:-$DEFAULT_REPO}"
REF="master"
TARGET="stream-parser"
WITH_TESTS=0
FORCE=0

usage() {
  cat <<USAGE
Usage: ${SCRIPT_NAME} [options]

Installs engine + json from ${DEFAULT_REPO}.

Options:
  --to <path>       Install target path (default: ${TARGET})
  --ref <ref>       Git ref/tag/branch (default: ${REF})
  --repo <owner/repo>
                    GitHub repo to fetch from (default: ${REPO})
  --with-tests      Include matching tests
  --force           Replace existing target path
  -h, --help        Show help

Examples:
  curl -fsSL https://raw.githubusercontent.com/${DEFAULT_REPO}/master/scripts/install-json.sh | bash
  curl -fsSL https://raw.githubusercontent.com/${DEFAULT_REPO}/master/scripts/install-json.sh | bash -s -- --to src/stream-parser --ref v0.1.0 --with-tests
USAGE
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --to)
      TARGET="$2"
      shift 2
      ;;
    --ref)
      REF="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    --with-tests)
      WITH_TESTS=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

need_cmd curl
need_cmd tar
need_cmd mktemp

if [[ -e "$TARGET" && "$FORCE" -ne 1 ]]; then
  echo "Target exists: ${TARGET}" >&2
  echo "Use --force to replace it, or choose --to <path>." >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

archive="$tmpdir/source.tar.gz"
url="https://codeload.github.com/${REPO}/tar.gz/${REF}"

printf 'Downloading %s (%s)\n' "$REPO" "$REF"
curl -fsSL "$url" -o "$archive"
tar -xzf "$archive" -C "$tmpdir"

src="$(find "$tmpdir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [[ -z "$src" || ! -d "$src/core" ]]; then
  echo "Failed to locate core/ in downloaded archive." >&2
  exit 1
fi

if [[ "$FORCE" -eq 1 ]]; then
  rm -rf "$TARGET"
fi
mkdir -p "$TARGET"

cp -R "$src/core/engine" "$TARGET/"
cp -R "$src/core/json" "$TARGET/"

cat > "$TARGET/index.ts" <<'INDEX'
export { StreamParser } from './engine/StreamParser'
export type { StreamParserOptions } from './engine/StreamParser'
export { JSONParser } from './json/JSONParser'
export type { ParsedJSONNode } from './json/JSONParser'
export { Lexer } from './json/Lexer'
export { jsonHandler } from './json/jsonHandler'
export type {
  ParsedNode,
  PatternHandler,
  FinalizeContext,
  StartContext,
  StepResult,
  StepControl,
  StepContext,
  StartResult,
  Writer
} from './engine/types'
INDEX

if [[ "$WITH_TESTS" -eq 1 ]]; then
  mkdir -p "$TARGET/__tests__"
  cp "$src/core/__tests__/jsonLexerComparison.test.ts" "$TARGET/__tests__/"
  cp "$src/core/__tests__/StreamParser.test.ts" "$TARGET/__tests__/"
fi

printf 'Installed %s to %s\n' "$MODE" "$TARGET"
