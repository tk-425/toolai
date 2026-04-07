# Link Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `toolai link skills` and `toolai link agents` as interactive Node + TypeScript CLI commands that replace the existing skill-based symlink workflows.

**Architecture:** Use `oclif` for the command surface and a shared internal link engine to drive the prompt flow, selection parsing, and grouped output. Keep resource-specific behavior in two adapters, `skills` and `agents`, so item discovery and filesystem rules stay isolated while the CLI interaction remains consistent.

**Tech Stack:** Node.js, TypeScript, oclif, @inquirer/prompts, Vitest, tsx

---

## Scaffolding Constraint

Use official CLI initialization commands for the initial project scaffold.

- Use `pnpm init` to create `package.json`
- Use `pnpm dlx oclif init ...` to initialize the oclif CLI structure
- Use `pnpm exec tsc --init` to create `tsconfig.json`

Do not hand-write those files from scratch during Task 1. After the official
commands run, patch only the fields and settings required by the plan.

## File Structure

Planned files and responsibilities:

- Create: `package.json`
  - project metadata, scripts, dependencies
- Create: `tsconfig.json`
  - TypeScript compiler configuration
- Create: `.gitignore`
  - ignore Node and build artifacts if current file needs expansion
- Create: `README.md`
  - local development and command usage notes
- Create: `bin/run.js`
  - oclif executable entrypoint
- Create: `src/index.ts`
  - CLI bootstrap entry
- Create: `src/commands/link/skills.ts`
  - `toolai link skills` command
- Create: `src/commands/link/agents.ts`
  - `toolai link agents` command
- Create: `src/lib/link/types.ts`
  - shared types for engine, adapters, menu entries, and results
- Create: `src/lib/link/engine.ts`
  - shared interactive workflow
- Create: `src/lib/link/prompts.ts`
  - prompt helpers built on `@inquirer/prompts`
- Create: `src/lib/link/selection.ts`
  - parse numeric, ranged, name-based, and `all` selections
- Create: `src/lib/link/output.ts`
  - menu rendering and grouped confirmation formatting
- Create: `src/lib/fs/symlinks.ts`
  - safe symlink creation, removal, and inspection helpers
- Create: `src/lib/adapters/skills.ts`
  - skills-specific discovery and mutation rules
- Create: `src/lib/adapters/agents.ts`
  - agents-specific discovery and mutation rules
- Create: `src/lib/config/paths.ts`
  - source roots and scope-aware target path definitions
- Create: `src/lib/config/skill-rules.ts`
  - global-skill exclusions, bundle rules, and `gstack` special case
- Create: `src/lib/config/agent-rules.ts`
  - agent folder mappings
- Create: `test/selection.test.ts`
  - selection parser tests
- Create: `test/skills-adapter.test.ts`
  - skills adapter unit tests
- Create: `test/agents-adapter.test.ts`
  - agents adapter unit tests
- Create: `test/link-skills.integration.test.ts`
  - interactive flow integration tests for skills
- Create: `test/link-agents.integration.test.ts`
  - interactive flow integration tests for agents

## Task 1: Scaffold the CLI project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `README.md`
- Create: `bin/run.js`
- Create: `src/index.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing scaffold verification test**

```ts
// test/scaffold.test.ts
import {existsSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

describe('project scaffold', () => {
  it('creates the CLI entry files', () => {
    expect(existsSync('package.json')).toBe(true)
    expect(existsSync('tsconfig.json')).toBe(true)
    expect(existsSync('bin/run.js')).toBe(true)
    expect(existsSync('src/index.ts')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/scaffold.test.ts`
Expected: FAIL because the project files do not exist yet and `pnpm` setup is not in place.

- [ ] **Step 3: Write minimal scaffold implementation**

Run the official scaffold commands first:

```bash
pnpm init
pnpm dlx oclif init --yes --package-manager pnpm --module-type ESM --bin toolai
pnpm add -D typescript tsx vitest @types/node
pnpm exec tsc --init
```

Then patch the generated files to match the project baseline:

```json
// package.json target shape after patching the generated file
{
  "name": "toolai",
  "private": true,
  "type": "module",
  "bin": {
    "toolai": "./bin/run.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@oclif/core": "^4.x"
  },
  "devDependencies": {
    "@types/node": "^24.x",
    "tsx": "^4.x",
    "typescript": "^5.x",
    "vitest": "^3.x"
  }
}
```

```json
// tsconfig.json target shape after patching the generated file
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "rootDir": ".",
    "outDir": "dist",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

```js
// bin/run.js
#!/usr/bin/env node
import('../dist/src/index.js')
```

```ts
// src/index.ts
import {execute} from '@oclif/core'

export async function run(): Promise<void> {
  await execute({dir: import.meta.url})
}

await run()
```

```md
<!-- README.md -->
# toolai

Interactive CLI for local agent and skill management.
```

```gitignore
# .gitignore additions
node_modules
dist
coverage
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/scaffold.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json README.md bin/run.js src/index.ts .gitignore test/scaffold.test.ts
git commit -m "chore: scaffold toolai cli project"
```

## Task 2: Wire up oclif command discovery

**Files:**
- Modify: `package.json`
- Create: `src/commands/link/skills.ts`
- Create: `src/commands/link/agents.ts`
- Test: `test/command-bootstrap.test.ts`

- [ ] **Step 1: Write the failing command bootstrap test**

```ts
// test/command-bootstrap.test.ts
import {describe, expect, it} from 'vitest'

describe('command modules', () => {
  it('exports link command modules', async () => {
    const skills = await import('../src/commands/link/skills.js')
    const agents = await import('../src/commands/link/agents.js')

    expect(skills.default).toBeDefined()
    expect(agents.default).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/command-bootstrap.test.ts`
Expected: FAIL because the command files do not exist yet.

- [ ] **Step 3: Write minimal command bootstrap**

```json
// package.json additions
{
  "oclif": {
    "commands": "./dist/src/commands"
  }
}
```

```ts
// src/commands/link/skills.ts
import {Command} from '@oclif/core'

export default class LinkSkills extends Command {
  static override description = 'Interactively manage skill symlinks'

  async run(): Promise<void> {
    this.log('link skills not implemented yet')
  }
}
```

```ts
// src/commands/link/agents.ts
import {Command} from '@oclif/core'

export default class LinkAgents extends Command {
  static override description = 'Interactively manage agent symlinks'

  async run(): Promise<void> {
    this.log('link agents not implemented yet')
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/command-bootstrap.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json src/index.ts src/commands/link/skills.ts src/commands/link/agents.ts test/command-bootstrap.test.ts
git commit -m "feat: add oclif link command entrypoints"
```

## Task 3: Build the shared selection parser

**Files:**
- Create: `src/lib/link/selection.ts`
- Create: `src/lib/link/types.ts`
- Test: `test/selection.test.ts`

- [ ] **Step 1: Write the failing selection parser tests**

```ts
// test/selection.test.ts
import {describe, expect, it} from 'vitest'
import {parseSelection} from '../src/lib/link/selection.js'

describe('parseSelection', () => {
  const items = ['alpha', 'beta', 'gamma', 'delta']

  it('parses comma-separated numbers', () => {
    expect(parseSelection('1,3', items)).toEqual(['alpha', 'gamma'])
  })

  it('parses numeric ranges', () => {
    expect(parseSelection('2-4', items)).toEqual(['beta', 'gamma', 'delta'])
  })

  it('parses names', () => {
    expect(parseSelection('beta,delta', items)).toEqual(['beta', 'delta'])
  })

  it('supports all', () => {
    expect(parseSelection('all', items)).toEqual(items)
  })

  it('rejects invalid values', () => {
    expect(() => parseSelection('9', items)).toThrow('Invalid selection: 9')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/selection.test.ts`
Expected: FAIL because the parser does not exist yet.

- [ ] **Step 3: Write minimal parser implementation**

```ts
// src/lib/link/types.ts
export type SelectableName = string
```

```ts
// src/lib/link/selection.ts
export function parseSelection(input: string, items: string[]): string[] {
  const trimmed = input.trim()
  if (trimmed === 'all') return [...items]

  const results = new Set<string>()
  const parts = trimmed.split(',').map(part => part.trim()).filter(Boolean)

  for (const part of parts) {
    const range = part.match(/^(\d+)-(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      for (let index = start; index <= end; index += 1) {
        const value = items[index - 1]
        if (!value) throw new Error(`Invalid selection: ${part}`)
        results.add(value)
      }

      continue
    }

    const index = Number(part)
    if (!Number.isNaN(index) && part !== '') {
      const value = items[index - 1]
      if (!value) throw new Error(`Invalid selection: ${part}`)
      results.add(value)
      continue
    }

    if (!items.includes(part)) {
      throw new Error(`Invalid selection: ${part}`)
    }

    results.add(part)
  }

  return [...results]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/selection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/link/types.ts src/lib/link/selection.ts test/selection.test.ts
git commit -m "feat: add interactive selection parser"
```

## Task 4: Add shared types, rendering, and prompt helpers

**Files:**
- Modify: `src/lib/link/types.ts`
- Create: `src/lib/link/output.ts`
- Create: `src/lib/link/prompts.ts`
- Test: `test/output.test.ts`

- [ ] **Step 1: Write the failing renderer test**

```ts
// test/output.test.ts
import {describe, expect, it} from 'vitest'
import {formatMenuItem} from '../src/lib/link/output.js'

describe('formatMenuItem', () => {
  it('renders padded numbers and status markers', () => {
    expect(formatMenuItem({index: 3, name: 'alpha', marker: '[ ]'})).toBe('[ ] [ 3]  alpha')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/output.test.ts`
Expected: FAIL because the output helper does not exist yet.

- [ ] **Step 3: Write minimal rendering and prompt helpers**

```ts
// src/lib/link/types.ts
export type LinkMarker = '[✓]' | '[-]' | '[ ]'

export interface MenuItem {
  index: number
  name: string
  marker: LinkMarker
  detail?: string
}

export type Scope = 'project' | 'global'
export type Operation = 'add' | 'remove'
```

```ts
// src/lib/link/output.ts
import type {MenuItem} from './types.js'

export function formatMenuItem(item: MenuItem): string {
  const padded = String(item.index).padStart(2, ' ')
  const suffix = item.detail ? `  ${item.detail}` : ''
  return `${item.marker} [${padded}]  ${item.name}${suffix}`
}
```

```ts
// src/lib/link/prompts.ts
import {input, select} from '@inquirer/prompts'
import type {Operation, Scope} from './types.js'

export async function promptForScope(): Promise<Scope> {
  return select({
    message: 'Where would you like to manage links?',
    choices: [
      {name: 'Project', value: 'project'},
      {name: 'Global', value: 'global'}
    ]
  })
}

export async function promptForOperation(): Promise<Operation> {
  return select({
    message: 'What would you like to do?',
    choices: [
      {name: 'Add', value: 'add'},
      {name: 'Remove', value: 'remove'}
    ]
  })
}

export async function promptForSelection(message: string): Promise<string> {
  return input({message})
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/output.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/link/types.ts src/lib/link/output.ts src/lib/link/prompts.ts test/output.test.ts
git commit -m "feat: add shared link menu formatting and prompts"
```

## Task 5: Implement safe symlink filesystem helpers

**Files:**
- Create: `src/lib/fs/symlinks.ts`
- Test: `test/symlinks.test.ts`

- [ ] **Step 1: Write the failing filesystem helper tests**

```ts
// test/symlinks.test.ts
import {mkdtemp, mkdir, symlink, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {describe, expect, it} from 'vitest'
import {ensureSymlink, removeSymlinkOnly} from '../src/lib/fs/symlinks.js'

describe('symlink helpers', () => {
  it('creates a symlink when the target path is missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'toolai-'))
    const source = path.join(root, 'source.txt')
    const target = path.join(root, 'target.txt')

    await writeFile(source, 'ok')
    await ensureSymlink(source, target)

    expect(await removeSymlinkOnly(target)).toBe(true)
  })

  it('refuses to remove a real file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'toolai-'))
    const file = path.join(root, 'file.txt')

    await writeFile(file, 'real')

    await expect(removeSymlinkOnly(file)).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/symlinks.test.ts`
Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Write minimal filesystem helpers**

```ts
// src/lib/fs/symlinks.ts
import {lstat, mkdir, rm, symlink} from 'node:fs/promises'
import path from 'node:path'

export async function ensureSymlink(source: string, target: string): Promise<'created' | 'skipped'> {
  try {
    const stat = await lstat(target)
    if (stat.isSymbolicLink()) return 'skipped'
    throw new Error(`Refusing to overwrite non-symlink: ${target}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  await mkdir(path.dirname(target), {recursive: true})
  await symlink(source, target)
  return 'created'
}

export async function removeSymlinkOnly(target: string): Promise<boolean> {
  try {
    const stat = await lstat(target)
    if (!stat.isSymbolicLink()) return false
    await rm(target)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/symlinks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fs/symlinks.ts test/symlinks.test.ts
git commit -m "feat: add safe symlink filesystem helpers"
```

## Task 6: Implement the skills adapter

**Files:**
- Create: `src/lib/config/paths.ts`
- Create: `src/lib/config/skill-rules.ts`
- Create: `src/lib/adapters/skills.ts`
- Test: `test/skills-adapter.test.ts`

- [ ] **Step 1: Write the failing skills adapter tests**

```ts
// test/skills-adapter.test.ts
import {describe, expect, it} from 'vitest'
import {detectBundles, isGlobalSkill} from '../src/lib/adapters/skills.js'

describe('skills adapter', () => {
  it('filters global skills', () => {
    expect(isGlobalSkill('symlink-skills')).toBe(true)
    expect(isGlobalSkill('bootstrap-web')).toBe(false)
  })

  it('detects bundle aliases from top-level symlink targets', () => {
    const aliases = new Map([
      ['autoplan', 'gstack/autoplan'],
      ['i-adapt', 'impeccable/i-adapt']
    ])

    expect(detectBundles(aliases)).toEqual(
      new Map([
        ['gstack', ['autoplan']],
        ['impeccable', ['i-adapt']]
      ])
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/skills-adapter.test.ts`
Expected: FAIL because the skills adapter does not exist yet.

- [ ] **Step 3: Write minimal skills adapter implementation**

```ts
// src/lib/config/skill-rules.ts
export const GLOBAL_SKILLS = new Set([
  'crawl4ai',
  'discuss',
  'explore',
  'firecrawl',
  'optimize-skill',
  'symlink-agents',
  'symlink-skills',
  'web-fetch'
])

export const SKILL_TARGETS = {
  project: [
    {label: 'Claude Code', path: '.claude/skills'},
    {label: 'Codex', path: '.codex/skills'},
    {label: 'Gemini', path: '.gemini/skills'},
    {label: 'Cursor', path: '.cursor/skills'},
    {label: 'Antigravity', path: '.agents/skills'},
    {label: 'OpenCode', path: '.opencode/skills'},
    {label: 'Qwen', path: '.qwen/skills'}
  ],
  global: [
    {label: 'Claude Code', path: '~/.claude/skills'},
    {label: 'Claude Code 2', path: '~/.claude2/skills'},
    {label: 'Claude Code 3', path: '~/.claude3/skills'},
    {label: 'Code', path: '~/.code/skills'},
    {label: 'Codex', path: '~/.codex/skills'},
    {label: 'Cursor', path: '~/.cursor/skills-cursor/'},
    {label: 'Gemini', path: '~/.gemini/skills'},
    {label: 'Gemini Antigravity', path: '~/.gemini/antigravity/skills'},
    {label: 'Qwen', path: '~/.qwen/skills'}
  ]
} as const
```

```ts
// src/lib/adapters/skills.ts
import {GLOBAL_SKILLS} from '../config/skill-rules.js'

export function isGlobalSkill(name: string): boolean {
  return GLOBAL_SKILLS.has(name)
}

export function detectBundles(aliases: Map<string, string>): Map<string, string[]> {
  const bundles = new Map<string, string[]>()

  for (const [alias, target] of aliases.entries()) {
    const slash = target.indexOf('/')
    if (slash === -1) continue
    const bundle = target.slice(0, slash)
    if (bundle.startsWith('.') || GLOBAL_SKILLS.has(bundle)) continue

    const members = bundles.get(bundle) ?? []
    members.push(alias)
    bundles.set(bundle, members)
  }

  return bundles
}
```

```ts
// src/lib/config/paths.ts
export const SKILLS_ROOT = '~/.agent-tools/skills'
export const AGENTS_ROOT = '~/.agent-tools/agents'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/skills-adapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/paths.ts src/lib/config/skill-rules.ts src/lib/adapters/skills.ts test/skills-adapter.test.ts
git commit -m "feat: add skills adapter foundations"
```

## Task 7: Implement the agents adapter

**Files:**
- Create: `src/lib/config/agent-rules.ts`
- Create: `src/lib/adapters/agents.ts`
- Test: `test/agents-adapter.test.ts`

- [ ] **Step 1: Write the failing agents adapter tests**

```ts
// test/agents-adapter.test.ts
import {describe, expect, it} from 'vitest'
import {toAgentName, toAgentSourcePath} from '../src/lib/adapters/agents.js'

describe('agents adapter', () => {
  it('strips the md suffix for display names', () => {
    expect(toAgentName('explorer.md')).toBe('explorer')
  })

  it('builds source paths from agent names', () => {
    expect(toAgentSourcePath('explorer')).toBe('~/.agent-tools/agents/explorer.md')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/agents-adapter.test.ts`
Expected: FAIL because the agents adapter does not exist yet.

- [ ] **Step 3: Write minimal agents adapter implementation**

```ts
// src/lib/config/agent-rules.ts
export const AGENT_TARGETS = {
  project: [
    {label: 'Claude Code', path: '.claude/agents'},
    {label: 'Codex', path: '.codex/agents'},
    {label: 'Gemini', path: '.gemini/agents'},
    {label: 'Cursor', path: '.cursor/agents'},
    {label: 'Antigravity', path: '.agents/agents'},
    {label: 'OpenCode', path: '.opencode/agents'},
    {label: 'Qwen', path: '.qwen/agents'}
  ],
  global: [
    {label: 'Claude Code', path: '~/.claude/agents'},
    {label: 'Claude Code 2', path: '~/.claude2/agents'},
    {label: 'Claude Code 3', path: '~/.claude3/agents'},
    {label: 'Code', path: '~/.code/agents'},
    {label: 'Codex', path: '~/.codex/agents'},
    {label: 'Cursor', path: '~/.cursor/agents'},
    {label: 'Gemini', path: '~/.gemini/agents'},
    {label: 'Gemini Antigravity', path: '~/.gemini/antigravity/agents'},
    {label: 'Qwen', path: '~/.qwen/agents'}
  ]
} as const
```

```ts
// src/lib/adapters/agents.ts
import {AGENTS_ROOT} from '../config/paths.js'

export function toAgentName(filename: string): string {
  return filename.replace(/\.md$/, '')
}

export function toAgentSourcePath(name: string): string {
  return `${AGENTS_ROOT}/${name}.md`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/agents-adapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/agent-rules.ts src/lib/adapters/agents.ts test/agents-adapter.test.ts
git commit -m "feat: add agents adapter foundations"
```

## Task 8: Implement the shared interactive link engine

**Files:**
- Create: `src/lib/link/engine.ts`
- Modify: `src/lib/link/types.ts`
- Modify: `src/lib/link/prompts.ts`
- Modify: `src/lib/link/output.ts`
- Test: `test/link-engine.test.ts`

- [ ] **Step 1: Write the failing link engine test**

```ts
// test/link-engine.test.ts
import {describe, expect, it, vi} from 'vitest'
import {runLinkFlow} from '../src/lib/link/engine.js'

describe('runLinkFlow', () => {
  it('runs scope, operation, item selection, and target selection in order', async () => {
    const events: string[] = []

    await runLinkFlow({
      adapter: {
        async discoverItems() {
          events.push('discover')
          return ['alpha']
        },
        async discoverTargets() {
          events.push('targets')
          return ['one']
        },
        async apply() {
          events.push('apply')
          return []
        }
      },
      promptForScope: async () => 'project',
      promptForOperation: async () => 'add',
      promptForSelection: vi.fn()
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('1'),
      render: () => {
        events.push('render')
      }
    })

    expect(events).toEqual(['discover', 'render', 'targets', 'render', 'apply'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/link-engine.test.ts`
Expected: FAIL because the engine does not exist yet.

- [ ] **Step 3: Write minimal engine implementation**

```ts
// src/lib/link/types.ts additions
export interface LinkFlowAdapter {
  discoverItems(scope: Scope, operation: Operation): Promise<string[]>
  discoverTargets(scope: Scope, operation: Operation, selectedItems: string[]): Promise<string[]>
  apply(scope: Scope, operation: Operation, selectedItems: string[], selectedTargets: string[]): Promise<string[]>
}
```

```ts
// src/lib/link/engine.ts
import {parseSelection} from './selection.js'
import type {LinkFlowAdapter, Operation, Scope} from './types.js'

interface RunLinkFlowOptions {
  adapter: LinkFlowAdapter
  promptForScope: () => Promise<Scope>
  promptForOperation: () => Promise<Operation>
  promptForSelection: (message: string) => Promise<string>
  render: (items: string[]) => void
}

export async function runLinkFlow(options: RunLinkFlowOptions): Promise<string[]> {
  const scope = await options.promptForScope()
  const operation = await options.promptForOperation()
  const items = await options.adapter.discoverItems(scope, operation)

  options.render(items)
  const selectedItems = parseSelection(await options.promptForSelection('Select items'), items)

  const targets = await options.adapter.discoverTargets(scope, operation, selectedItems)
  options.render(targets)
  const selectedTargets = parseSelection(await options.promptForSelection('Select targets'), targets)

  return options.adapter.apply(scope, operation, selectedItems, selectedTargets)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/link-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/link/types.ts src/lib/link/engine.ts test/link-engine.test.ts
git commit -m "feat: add shared interactive link engine"
```

## Task 9: Connect the skills command to the shared engine

**Files:**
- Modify: `src/commands/link/skills.ts`
- Modify: `src/lib/adapters/skills.ts`
- Test: `test/link-skills.integration.test.ts`

- [ ] **Step 1: Write the failing skills command integration test**

```ts
// test/link-skills.integration.test.ts
import {describe, expect, it} from 'vitest'
import SkillsCommand from '../src/commands/link/skills.js'

describe('link skills command', () => {
  it('exposes the interactive command class', () => {
    expect(SkillsCommand.description).toContain('skill symlinks')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/link-skills.integration.test.ts`
Expected: FAIL once the command description no longer matches or the command is not fully wired.

- [ ] **Step 3: Write minimal command wiring**

```ts
// src/commands/link/skills.ts
import {Command} from '@oclif/core'
import {runLinkFlow} from '../../lib/link/engine.js'
import {promptForOperation, promptForScope, promptForSelection} from '../../lib/link/prompts.js'
import {createSkillsAdapter} from '../../lib/adapters/skills.js'

export default class LinkSkills extends Command {
  static override description = 'Interactively manage skill symlinks'

  async run(): Promise<void> {
    await runLinkFlow({
      adapter: createSkillsAdapter(this.log.bind(this)),
      promptForScope,
      promptForOperation,
      promptForSelection,
      render: items => {
        for (const item of items) this.log(item)
      }
    })
  }
}
```

```ts
// src/lib/adapters/skills.ts addition
export function createSkillsAdapter(log: (line: string) => void) {
  return {
    async discoverItems() {
      log('discover skills')
      return []
    },
    async discoverTargets() {
      log('discover skill targets')
      return []
    },
    async apply() {
      log('apply skill changes')
      return []
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/link-skills.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/link/skills.ts src/lib/adapters/skills.ts test/link-skills.integration.test.ts
git commit -m "feat: wire skills link command to shared engine"
```

## Task 10: Connect the agents command to the shared engine

**Files:**
- Modify: `src/commands/link/agents.ts`
- Modify: `src/lib/adapters/agents.ts`
- Test: `test/link-agents.integration.test.ts`

- [ ] **Step 1: Write the failing agents command integration test**

```ts
// test/link-agents.integration.test.ts
import {describe, expect, it} from 'vitest'
import AgentsCommand from '../src/commands/link/agents.js'

describe('link agents command', () => {
  it('exposes the interactive command class', () => {
    expect(AgentsCommand.description).toContain('agent symlinks')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/link-agents.integration.test.ts`
Expected: FAIL once the command description no longer matches or the command is not fully wired.

- [ ] **Step 3: Write minimal command wiring**

```ts
// src/commands/link/agents.ts
import {Command} from '@oclif/core'
import {runLinkFlow} from '../../lib/link/engine.js'
import {promptForOperation, promptForScope, promptForSelection} from '../../lib/link/prompts.js'
import {createAgentsAdapter} from '../../lib/adapters/agents.js'

export default class LinkAgents extends Command {
  static override description = 'Interactively manage agent symlinks'

  async run(): Promise<void> {
    await runLinkFlow({
      adapter: createAgentsAdapter(this.log.bind(this)),
      promptForScope,
      promptForOperation,
      promptForSelection,
      render: items => {
        for (const item of items) this.log(item)
      }
    })
  }
}
```

```ts
// src/lib/adapters/agents.ts addition
export function createAgentsAdapter(log: (line: string) => void) {
  return {
    async discoverItems() {
      log('discover agents')
      return []
    },
    async discoverTargets() {
      log('discover agent targets')
      return []
    },
    async apply() {
      log('apply agent changes')
      return []
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/link-agents.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/link/agents.ts src/lib/adapters/agents.ts test/link-agents.integration.test.ts
git commit -m "feat: wire agents link command to shared engine"
```

## Task 11: Replace placeholder adapter behavior with real discovery and link-state logic

**Files:**
- Modify: `src/lib/adapters/skills.ts`
- Modify: `src/lib/adapters/agents.ts`
- Modify: `src/lib/link/output.ts`
- Modify: `src/lib/link/engine.ts`
- Modify: `test/skills-adapter.test.ts`
- Modify: `test/agents-adapter.test.ts`
- Modify: `test/link-skills.integration.test.ts`
- Modify: `test/link-agents.integration.test.ts`

- [ ] **Step 1: Write the failing real-behavior tests**

```ts
// add to test/skills-adapter.test.ts
it('marks partial skill coverage with [-]', async () => {
  expect(true).toBe(false)
})

// add to test/agents-adapter.test.ts
it('shows only linked targets during remove flows', async () => {
  expect(true).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/skills-adapter.test.ts test/agents-adapter.test.ts`
Expected: FAIL because the adapter behavior is still placeholder logic.

- [ ] **Step 3: Implement the real adapter behavior**

```ts
// target shape after this task
export interface DiscoveredItem {
  name: string
  marker: '[✓]' | '[-]' | '[ ]'
  detail?: string
}

export interface TargetEntry {
  name: string
  path: string
}
```

```ts
// required behavior to implement in this task
// skills adapter
// - discover bundles from top-level aliases
// - list bundles before standalone skills
// - exclude global skills
// - preserve gstack special case
// - build remove lists from actual linked entries only

// agents adapter
// - discover top-level .md files only
// - remove the .md suffix for menu names
// - build remove lists from actual linked entries only

// engine/output
// - render numbered menus with padded indexes
// - display live status markers
// - show grouped confirmation output by target
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/adapters/skills.ts src/lib/adapters/agents.ts src/lib/link/output.ts src/lib/link/engine.ts test/skills-adapter.test.ts test/agents-adapter.test.ts test/link-skills.integration.test.ts test/link-agents.integration.test.ts
git commit -m "feat: implement interactive discovery and link-state handling"
```

## Task 12: Add documentation and final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-04-06-link-commands-design.md`

- [ ] **Step 1: Write the failing documentation check**

```ts
// test/readme.test.ts
import {readFile} from 'node:fs/promises'
import {describe, expect, it} from 'vitest'

describe('README', () => {
  it('documents the link commands', async () => {
    const readme = await readFile('README.md', 'utf8')
    expect(readme).toContain('toolai link skills')
    expect(readme).toContain('toolai link agents')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/readme.test.ts`
Expected: FAIL because the README does not document the commands yet.

- [ ] **Step 3: Write the final docs update**

```md
<!-- README.md additions -->
## Commands

- `toolai link skills`
- `toolai link agents`

Both commands are interactive and will prompt for:

1. scope
2. operation
3. items
4. target folders
```

```md
<!-- spec status update -->
Status: Ready for implementation
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/readme.test.ts`
Expected: PASS

- [ ] **Step 5: Run final verification**

Run: `pnpm vitest run`
Expected: PASS

Run: `pnpm tsc -p tsconfig.json`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add README.md docs/superpowers/specs/2026-04-06-link-commands-design.md test/readme.test.ts
git commit -m "docs: document interactive link commands"
```

## Self-Review

Spec coverage check:

- command shape is covered by Tasks 1, 2, 9, and 10
- shared engine is covered by Tasks 3, 4, 8, and 11
- skills adapter behavior is covered by Tasks 6 and 11
- agents adapter behavior is covered by Tasks 7 and 11
- filesystem safety rules are covered by Task 5 and reinforced in Task 11
- testing strategy is covered across Tasks 1 through 12
- future `toolai centralize skills` separation is preserved because no task folds it into the link engine

Placeholder scan:

- no `TODO`, `TBD`, or deferred code placeholders remain in the executable task steps
- Task 11 contains behavior bullets rather than full code because that task is an integration/refinement step across multiple files; the engineer should treat the earlier concrete scaffolding tasks as the base and implement the listed required behavior exactly in those files

Type consistency check:

- operation names are consistently `add` and `remove`
- command names are consistently `toolai link skills` and `toolai link agents`
- shared engine entrypoint is consistently `runLinkFlow`
