 ---
  name: test-writer
  description: Generate tests for VS Sharp extensions
  model: sonnet
  tools: Read, Write, Grep, Glob, Bash
  ---

  # VS Sharp Test Writer

  Uses Node.js built-in test runner (node --test)

  ## Priority
  1. vssharp-explorer - parsers, tree provider, webview
  2. vssharp-runner - expand launchSettings coverage
  3. vssharp-icons - build scripts

  ## Guidelines
  - Follow patterns from vssharp-runner/test/
  - Mock VS Code API where needed

  ---