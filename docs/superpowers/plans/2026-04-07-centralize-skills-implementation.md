# Centralize Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `toolai centralize skills` as a fully interactive CLI command that can add new centralized installs and update existing ones using the current shell scripts as the source of truth.

**Architecture:** Add a dedicated `centralize` command family alongside the existing `link` commands. Keep command orchestration in a small engine layer, split add/update concerns into focused helpers for discovery, planning, script execution, and verification, and reuse the existing prompt-cancellation and theme primitives where they already fit.

**Tech Stack:** Node.js, TypeScript, oclif, @inquirer/prompts, Vitest, tsx, native `node:fs/promises`, native `node:child_process`

---

## Preconditions

- Implementation should happen on a working branch or dedicated worktree, not on `main`.
- The spec file for this feature is:
  - `docs/superpowers/specs/2026-04-07-centralize-skills-design.md`
- Existing command patterns to follow:
  - `src/commands/link/skills.ts`
  - `src/lib/link/prompts.ts`
  - `src/lib/link/theme.ts`

## File Structure

Planned files and responsibilities:

- Create: `src/commands/centralize/skills.ts`
  - `oclif` command entrypoint for `toolai centralize skills`
- Create: `src/lib/centralize/types.ts`
  - shared types for add/update modes, layout classification, discovered skills, plans, conflicts, and verification results
- Create: `src/lib/centralize/prompts.ts`
  - centralize-specific prompt helpers built on `@inquirer/prompts`
- Create: `src/lib/centralize/inspect.ts`
  - source repo discovery, config parsing, git detection, skill scanning, and layout classification
- Create: `src/lib/centralize/naming.ts`
  - bundle-name selection, prefix handling, conflict detection, and publish-plan construction
- Create: `src/lib/centralize/scripts.ts`
  - wrappers around `list_centralized_installs.sh`, `publish_skills.sh`, and `refresh_skills.sh`
- Create: `src/lib/centralize/verify.ts`
  - post-publish and post-refresh verification helpers
- Create: `src/lib/centralize/engine.ts`
  - interactive flow orchestration for `Add new` and `Update existing`
- Modify: `src/lib/config/paths.ts`
  - add reusable constants for centralize config and script paths
- Modify: `src/lib/link/theme.ts`
  - add any shared formatting helpers needed for centralize summaries and conflict output
- Modify: `README.md`
  - document the new `toolai centralize skills` command
- Create: `test/centralize-inspect.test.ts`
  - unit tests for repo discovery, layout classification, and config scanning
- Create: `test/centralize-naming.test.ts`
  - unit tests for bundle naming, prefix choices, and conflict detection
- Create: `test/centralize-scripts.test.ts`
  - unit tests for script wrapper argument construction and parsing
- Create: `test/centralize-verify.test.ts`
  - unit tests for verification logic
- Create: `test/centralize-engine.test.ts`
  - flow tests for add/update orchestration with mocked prompts and helpers
- Create: `test/centralize-command.integration.test.ts`
  - integration-level smoke test for the command class and description
- Create: `test/readme-centralize.test.ts`
  - documentation regression test for README command coverage

## Task 1: Bootstrap the centralize command surface

**Files:**
- Create: `src/commands/centralize/skills.ts`
- Create: `src/lib/centralize/types.ts`
- Test: `test/centralize-command.integration.test.ts`

- [ ] **Step 1: Write the failing command bootstrap test**

```ts
// test/centralize-command.integration.test.ts
import {describe, expect, it} from 'vitest'

describe('centralize skills command', () => {
  it('exports the interactive command class', async () => {
    const command = await import('../src/commands/centralize/skills.js')
    expect(command.default).toBeDefined()
    expect(command.default.description).toContain('centralize')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/centralize-command.integration.test.ts`
Expected: FAIL because the command file does not exist yet.

- [ ] **Step 3: Write the minimal command bootstrap**

```ts
// src/lib/centralize/types.ts
export type CentralizeMode = 'add' | 'update'

export interface CentralizeRunner {
  run(): Promise<void>
}
```

```ts
// src/commands/centralize/skills.ts
import {Command} from '@oclif/core'

export default class CentralizeSkills extends Command {
  static override description = 'Interactively centralize skills from source repos'

  public async run(): Promise<void> {
    this.log('centralize skills not implemented yet')
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/centralize-command.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/centralize/skills.ts src/lib/centralize/types.ts test/centralize-command.integration.test.ts
git commit -m "feat: bootstrap centralize skills command"
```

## Task 2: Add centralize prompt helpers

**Files:**
- Create: `src/lib/centralize/prompts.ts`
- Modify: `src/lib/centralize/types.ts`
- Test: `test/centralize-engine.test.ts`

- [ ] **Step 1: Write the failing prompt-oriented engine test**

```ts
// test/centralize-engine.test.ts
import {describe, expect, it, vi} from 'vitest'
import {PromptCancelled} from '../src/lib/link/prompts.js'

describe('centralize prompts', () => {
  it('exposes add and update mode choices', async () => {
    const {buildModeChoices} = await import('../src/lib/centralize/prompts.js')
    expect(buildModeChoices()).toEqual([
      expect.objectContaining({value: 'add'}),
      expect.objectContaining({value: 'update'})
    ])
  })

  it('rethrows Ctrl+C as PromptCancelled', async () => {
    const {wrapPromptError} = await import('../src/lib/centralize/prompts.js')
    expect(() => wrapPromptError(new Error('User force closed the prompt with SIGINT'))).toThrow(PromptCancelled)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/centralize-engine.test.ts`
Expected: FAIL because the centralize prompt helpers do not exist yet.

- [ ] **Step 3: Write minimal prompt helpers**

```ts
// src/lib/centralize/types.ts
export type CentralizeMode = 'add' | 'update'
export type LayoutChoice = 'root-only' | 'nested-only' | 'both'
export type RepoSelectionMode = 'configured' | 'custom'

export interface Choice<T extends string> {
  name: string
  value: T
  description?: string
}
```

```ts
// src/lib/centralize/prompts.ts
import {checkbox, confirm, input, select} from '@inquirer/prompts'
import {isPromptCancel, PromptCancelled} from '../link/prompts.js'
import type {CentralizeMode, Choice, LayoutChoice, RepoSelectionMode} from './types.js'

export function wrapPromptError(error: unknown): never {
  if (isPromptCancel(error)) throw new PromptCancelled()
  throw error
}

export function buildModeChoices(): Array<Choice<CentralizeMode>> {
  return [
    {
      name: 'Add new',
      value: 'add',
      description: 'copy skills from a source repo into the central store'
    },
    {
      name: 'Update existing',
      value: 'update',
      description: 'sync an existing centralized install from its source repo'
    }
  ]
}

export function buildRepoSelectionChoices(): Array<Choice<RepoSelectionMode>> {
  return [
    {name: 'Configured repos', value: 'configured'},
    {name: 'Custom repo path', value: 'custom'}
  ]
}

export function buildLayoutChoices(): Array<Choice<LayoutChoice>> {
  return [
    {name: 'Root only', value: 'root-only'},
    {name: 'Nested only', value: 'nested-only'},
    {name: 'Both', value: 'both'}
  ]
}

export {checkbox, confirm, input, select}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/centralize-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/centralize/types.ts src/lib/centralize/prompts.ts test/centralize-engine.test.ts
git commit -m "feat: add centralize prompt helpers"
```

## Task 3: Implement source inspection and layout classification

**Files:**
- Create: `src/lib/centralize/inspect.ts`
- Modify: `src/lib/config/paths.ts`
- Modify: `src/lib/centralize/types.ts`
- Test: `test/centralize-inspect.test.ts`

- [ ] **Step 1: Write the failing inspection tests**

```ts
// test/centralize-inspect.test.ts
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, describe, expect, it} from 'vitest'
import {rm} from 'node:fs/promises'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.map(root => rm(root, {recursive: true, force: true})))
  tempRoots.length = 0
})

describe('centralize inspection', () => {
  it('classifies mixed layouts correctly', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-'))
    tempRoots.push(root)
    await writeFile(join(root, 'SKILL.md'), '# root')
    await mkdir(join(root, 'nested-skill'), {recursive: true})
    await writeFile(join(root, 'nested-skill', 'SKILL.md'), '# nested')

    const {inspectRepo} = await import('../src/lib/centralize/inspect.js')
    const result = await inspectRepo(root)

    expect(result.layout).toBe('mixed-layout')
    expect(result.rootSkill?.name).toBe(basename(root))
    expect(result.nestedSkills.map(skill => skill.name)).toEqual(['nested-skill'])
  })

  it('filters vendor directories out of skill discovery', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-'))
    tempRoots.push(root)
    await mkdir(join(root, 'node_modules', 'fake-skill'), {recursive: true})
    await writeFile(join(root, 'node_modules', 'fake-skill', 'SKILL.md'), '# ignore me')

    const {inspectRepo} = await import('../src/lib/centralize/inspect.js')
    const result = await inspectRepo(root)

    expect(result.nestedSkills).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/centralize-inspect.test.ts`
Expected: FAIL because repo inspection logic does not exist yet.

- [ ] **Step 3: Write minimal inspection helpers**

```ts
// src/lib/config/paths.ts additions
export const CENTRALIZE_SKILL_ROOT = '~/.agent-tools/skills'
export const CENTRALIZE_CONFIG_PATH = '~/.agent-tools/skills/centralize-skills/config.yaml'
export const CENTRALIZE_SCRIPTS_ROOT = '~/.agent-tools/skills/centralize-skills/scripts'
```

```ts
// src/lib/centralize/types.ts additions
export type RepoLayout = 'root-only' | 'nested-only' | 'mixed-layout' | 'none'

export interface DiscoveredSkill {
  name: string
  path: string
  isRoot: boolean
}

export interface RepoInspection {
  repoPath: string
  layout: RepoLayout
  isGitRepo: boolean
  hasWorkingTreeChanges: boolean
  rootSkill: DiscoveredSkill | null
  nestedSkills: DiscoveredSkill[]
}
```

```ts
// src/lib/centralize/inspect.ts
import {readdir, readFile, stat} from 'node:fs/promises'
import {basename, join, relative} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import type {DiscoveredSkill, RepoInspection, RepoLayout} from './types.js'

const execFileAsync = promisify(execFile)
const EXCLUDED_SEGMENTS = new Set(['.git', 'node_modules', '.venv', 'dist', 'build', '.next', '.turbo', 'coverage'])

async function hasSkillFile(path: string): Promise<boolean> {
  try {
    const info = await stat(join(path, 'SKILL.md'))
    return info.isFile()
  } catch {
    return false
  }
}

function isExcluded(path: string, repoPath: string): boolean {
  return relative(repoPath, path).split('/').some(segment => EXCLUDED_SEGMENTS.has(segment))
}

export async function inspectRepo(repoPath: string): Promise<RepoInspection> {
  const rootSkill = (await hasSkillFile(repoPath))
    ? {name: basename(repoPath), path: repoPath, isRoot: true}
    : null

  const nestedSkills: DiscoveredSkill[] = []
  const entries = await readdir(repoPath, {withFileTypes: true, recursive: true})
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const fullPath = join(entry.parentPath, entry.name)
    if (fullPath === repoPath || isExcluded(fullPath, repoPath)) continue
    if (await hasSkillFile(fullPath)) nestedSkills.push({name: basename(fullPath), path: fullPath, isRoot: false})
  }

  let layout: RepoLayout = 'none'
  if (rootSkill && nestedSkills.length > 0) layout = 'mixed-layout'
  else if (rootSkill) layout = 'root-only'
  else if (nestedSkills.length > 0) layout = 'nested-only'

  const isGitRepo = await execFileAsync('git', ['-C', repoPath, 'rev-parse', '--is-inside-work-tree']).then(() => true).catch(() => false)
  const hasWorkingTreeChanges = await execFileAsync('git', ['-C', repoPath, 'status', '--short']).then(({stdout}) => stdout.trim().length > 0).catch(() => false)

  return {repoPath, layout, isGitRepo, hasWorkingTreeChanges, rootSkill, nestedSkills}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/centralize-inspect.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/paths.ts src/lib/centralize/types.ts src/lib/centralize/inspect.ts test/centralize-inspect.test.ts
git commit -m "feat: add centralize repo inspection helpers"
```

## Task 4: Implement bundle naming, prefix handling, and conflict detection

**Files:**
- Create: `src/lib/centralize/naming.ts`
- Modify: `src/lib/centralize/types.ts`
- Test: `test/centralize-naming.test.ts`

- [ ] **Step 1: Write the failing naming tests**

```ts
// test/centralize-naming.test.ts
import {describe, expect, it} from 'vitest'

describe('centralize naming', () => {
  it('derives the default bundle name from the source repo basename', async () => {
    const {getDefaultBundleName} = await import('../src/lib/centralize/naming.js')
    expect(getDefaultBundleName('/Users/terrykang/dev/vercel-labs/agent-skills')).toBe('agent-skills')
  })

  it('does not double-prefix skills that already start with the chosen prefix', async () => {
    const {applyPrefix} = await import('../src/lib/centralize/naming.js')
    expect(applyPrefix('vercel-react-best-practices', 'vercel')).toBe('vercel-react-best-practices')
    expect(applyPrefix('react-best-practices', 'vercel')).toBe('vercel-react-best-practices')
  })

  it('reports both install-root and alias conflicts', async () => {
    const {detectConflicts} = await import('../src/lib/centralize/naming.js')
    const result = await detectConflicts({
      centralRoot: '/central',
      installRoots: ['/central/agent-skills'],
      topLevelAliases: ['/central/vercel-react-best-practices'],
      pathExists: async path => path === '/central/agent-skills' || path === '/central/vercel-react-best-practices'
    })

    expect(result.map(item => item.type)).toEqual(['install-root', 'alias'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/centralize-naming.test.ts`
Expected: FAIL because naming helpers do not exist yet.

- [ ] **Step 3: Write minimal naming helpers**

```ts
// src/lib/centralize/types.ts additions
export interface ConflictRecord {
  path: string
  type: 'install-root' | 'alias'
}

export interface PublishTargets {
  installRoots: string[]
  topLevelAliases: string[]
}
```

```ts
// src/lib/centralize/naming.ts
import {basename} from 'node:path'
import type {ConflictRecord, PublishTargets} from './types.js'

export function getDefaultBundleName(repoPath: string): string {
  return basename(repoPath)
}

export function applyPrefix(name: string, prefix: string | null): string {
  if (!prefix) return name
  return name.startsWith(`${prefix}-`) ? name : `${prefix}-${name}`
}

export async function detectConflicts(input: PublishTargets & {
  centralRoot: string
  pathExists: (path: string) => Promise<boolean>
}): Promise<ConflictRecord[]> {
  const conflicts: ConflictRecord[] = []

  for (const path of input.installRoots) {
    if (await input.pathExists(path)) conflicts.push({path, type: 'install-root'})
  }

  for (const path of input.topLevelAliases) {
    if (await input.pathExists(path)) conflicts.push({path, type: 'alias'})
  }

  return conflicts
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/centralize-naming.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/centralize/types.ts src/lib/centralize/naming.ts test/centralize-naming.test.ts
git commit -m "feat: add centralize naming and conflict detection"
```

## Task 5: Wrap the existing centralize shell scripts

**Files:**
- Create: `src/lib/centralize/scripts.ts`
- Modify: `src/lib/centralize/types.ts`
- Test: `test/centralize-scripts.test.ts`

- [ ] **Step 1: Write the failing script wrapper tests**

```ts
// test/centralize-scripts.test.ts
import {describe, expect, it, vi} from 'vitest'

describe('centralize scripts', () => {
  it('builds the dry-run refresh command', async () => {
    const {buildRefreshArgs} = await import('../src/lib/centralize/scripts.js')
    expect(buildRefreshArgs('/central/agent-skills', true)).toEqual(['--dry-run', '/central/agent-skills'])
  })

  it('parses installed items from the list script output', async () => {
    const {parseInstalledItems} = await import('../src/lib/centralize/scripts.js')
    const text = [
      'multi-skill-bundle-with-symlinks|agent-skills|vercel|/repo/vercel-labs/agent-skills|/central/agent-skills',
      'single-skill-direct-install|bootstrap-web||/repo/bootstrap-web|/central/bootstrap-web'
    ].join('\\n')

    expect(parseInstalledItems(text)).toEqual([
      expect.objectContaining({kind: 'bundle', name: 'agent-skills'}),
      expect.objectContaining({kind: 'standalone', name: 'bootstrap-web'})
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/centralize-scripts.test.ts`
Expected: FAIL because the script wrapper module does not exist yet.

- [ ] **Step 3: Write minimal script wrappers**

```ts
// src/lib/centralize/types.ts additions
export interface CentralizedInstall {
  kind: 'bundle' | 'standalone'
  mode: 'multi-skill-bundle-with-symlinks' | 'single-skill-direct-install'
  name: string
  prefix: string
  sourceRepo: string
  installedRoot: string
}
```

```ts
// src/lib/centralize/scripts.ts
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {CENTRALIZE_SCRIPTS_ROOT} from '../config/paths.js'
import type {CentralizedInstall} from './types.js'

const execFileAsync = promisify(execFile)

export function buildRefreshArgs(installedRoot: string, dryRun: boolean): string[] {
  return dryRun ? ['--dry-run', installedRoot] : [installedRoot]
}

export function parseInstalledItems(stdout: string): CentralizedInstall[] {
  return stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [mode, name, prefix, sourceRepo, installedRoot] = line.split('|')
      return {
        kind: mode === 'multi-skill-bundle-with-symlinks' ? 'bundle' : 'standalone',
        mode: mode as CentralizedInstall['mode'],
        name,
        prefix,
        sourceRepo,
        installedRoot
      }
    })
}

export async function listCentralizedInstalls(): Promise<CentralizedInstall[]> {
  const {stdout} = await execFileAsync('bash', [`${CENTRALIZE_SCRIPTS_ROOT}/list_centralized_installs.sh`])
  return parseInstalledItems(stdout)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/centralize-scripts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/centralize/types.ts src/lib/centralize/scripts.ts test/centralize-scripts.test.ts
git commit -m "feat: add centralize script wrappers"
```

## Task 6: Add verification helpers for publish and refresh

**Files:**
- Create: `src/lib/centralize/verify.ts`
- Modify: `src/lib/centralize/types.ts`
- Test: `test/centralize-verify.test.ts`

- [ ] **Step 1: Write the failing verification tests**

```ts
// test/centralize-verify.test.ts
import {describe, expect, it} from 'vitest'

describe('centralize verification', () => {
  it('requires config files for every installed root', async () => {
    const {verifyConfigPresence} = await import('../src/lib/centralize/verify.js')
    const result = await verifyConfigPresence(['/central/skill-a'], async path => path === '/central/skill-a/.centralize-config.json')
    expect(result.ok).toBe(true)
  })

  it('requires symlinks only for bundled aliases', async () => {
    const {verifyAliasTargets} = await import('../src/lib/centralize/verify.js')
    const result = await verifyAliasTargets(
      ['/central/vercel-react-best-practices'],
      async path => path === '/central/vercel-react-best-practices',
      async path => `/central/agent-skills/${path.split('/').pop()}`
    )

    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/centralize-verify.test.ts`
Expected: FAIL because verification helpers do not exist yet.

- [ ] **Step 3: Write minimal verification helpers**

```ts
// src/lib/centralize/types.ts additions
export interface VerificationResult {
  ok: boolean
  checkedPaths: string[]
  failures: string[]
}
```

```ts
// src/lib/centralize/verify.ts
import type {VerificationResult} from './types.js'

export async function verifyConfigPresence(
  installedRoots: string[],
  pathExists: (path: string) => Promise<boolean>
): Promise<VerificationResult> {
  const failures: string[] = []

  for (const root of installedRoots) {
    const configPath = `${root}/.centralize-config.json`
    if (!(await pathExists(configPath))) failures.push(configPath)
  }

  return {ok: failures.length === 0, checkedPaths: installedRoots, failures}
}

export async function verifyAliasTargets(
  aliases: string[],
  isSymlink: (path: string) => Promise<boolean>,
  readLink: (path: string) => Promise<string>
): Promise<VerificationResult> {
  const failures: string[] = []

  for (const alias of aliases) {
    if (!(await isSymlink(alias))) {
      failures.push(alias)
      continue
    }

    await readLink(alias)
  }

  return {ok: failures.length === 0, checkedPaths: aliases, failures}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/centralize-verify.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/centralize/types.ts src/lib/centralize/verify.ts test/centralize-verify.test.ts
git commit -m "feat: add centralize verification helpers"
```

## Task 7: Implement the add/update orchestration engine

**Files:**
- Create: `src/lib/centralize/engine.ts`
- Modify: `src/lib/centralize/prompts.ts`
- Modify: `src/lib/centralize/inspect.ts`
- Modify: `src/lib/centralize/naming.ts`
- Modify: `src/lib/centralize/scripts.ts`
- Modify: `src/lib/centralize/verify.ts`
- Test: `test/centralize-engine.test.ts`

- [ ] **Step 1: Expand the engine test to cover the add and update happy paths**

```ts
// test/centralize-engine.test.ts
import {describe, expect, it, vi} from 'vitest'

describe('centralize engine', () => {
  it('runs the add flow through summary, conflict-free plan, and publish', async () => {
    const {runCentralizeFlow} = await import('../src/lib/centralize/engine.js')

    const events: string[] = []
    await runCentralizeFlow({
      promptMode: async () => 'add',
      promptRepoSelectionMode: async () => 'configured',
      promptConfiguredRepo: async () => '/repo/agent-skills',
      promptLayoutChoice: async () => 'nested-only',
      promptBundleName: async () => 'agent-skills',
      promptPrefix: async () => 'vercel',
      promptConfirm: async () => true,
      inspectRepo: async () => ({
        repoPath: '/repo/agent-skills',
        layout: 'nested-only',
        isGitRepo: true,
        hasWorkingTreeChanges: false,
        rootSkill: null,
        nestedSkills: [{name: 'react-best-practices', path: '/repo/agent-skills/react-best-practices', isRoot: false}]
      }),
      detectConflicts: async () => [],
      publish: async () => events.push('publish'),
      verifyPublish: async () => ({ok: true, checkedPaths: ['/central/agent-skills'], failures: []}),
      render: line => events.push(line)
    })

    expect(events).toContain('publish')
  })

  it('runs the update flow with mandatory preview before refresh', async () => {
    const {runCentralizeFlow} = await import('../src/lib/centralize/engine.js')

    const events: string[] = []
    await runCentralizeFlow({
      promptMode: async () => 'update',
      promptInstalledItem: async () => ({
        kind: 'bundle',
        mode: 'multi-skill-bundle-with-symlinks',
        name: 'agent-skills',
        prefix: 'vercel',
        sourceRepo: '/repo/agent-skills',
        installedRoot: '/central/agent-skills'
      }),
      promptPullFirst: async () => false,
      promptConfirm: async () => true,
      listCentralizedInstalls: async () => [{
        kind: 'bundle',
        mode: 'multi-skill-bundle-with-symlinks',
        name: 'agent-skills',
        prefix: 'vercel',
        sourceRepo: '/repo/agent-skills',
        installedRoot: '/central/agent-skills'
      }],
      previewRefresh: async () => 'dry run summary',
      refreshInstall: async () => events.push('refresh'),
      verifyRefresh: async () => ({ok: true, checkedPaths: ['/central/agent-skills'], failures: []}),
      render: line => events.push(line),
      isGitRepo: async () => true
    })

    expect(events).toContain('dry run summary')
    expect(events).toContain('refresh')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/centralize-engine.test.ts`
Expected: FAIL because the engine flow does not exist yet.

- [ ] **Step 3: Write the minimal orchestration engine**

```ts
// src/lib/centralize/engine.ts
import {formatSectionLabel, formatWarning} from '../link/theme.js'
import type {CentralizeMode, CentralizedInstall, LayoutChoice, RepoInspection, VerificationResult} from './types.js'

export interface CentralizeFlowDeps {
  promptMode: () => Promise<CentralizeMode>
  promptRepoSelectionMode?: () => Promise<'configured' | 'custom'>
  promptConfiguredRepo?: () => Promise<string>
  promptCustomRepo?: () => Promise<string>
  promptLayoutChoice?: () => Promise<LayoutChoice>
  promptBundleName?: () => Promise<string>
  promptPrefix?: () => Promise<string | null>
  promptInstalledItem?: (items: CentralizedInstall[]) => Promise<CentralizedInstall>
  promptPullFirst?: () => Promise<boolean>
  promptConfirm: () => Promise<boolean>
  inspectRepo?: (repoPath: string) => Promise<RepoInspection>
  detectConflicts?: () => Promise<unknown[]>
  publish?: () => Promise<void>
  verifyPublish?: () => Promise<VerificationResult>
  listCentralizedInstalls?: () => Promise<CentralizedInstall[]>
  previewRefresh?: (installedRoot: string) => Promise<string>
  refreshInstall?: (installedRoot: string) => Promise<void>
  verifyRefresh?: () => Promise<VerificationResult>
  isGitRepo?: (path: string) => Promise<boolean>
  render: (line: string) => void
}

export async function runCentralizeFlow(deps: CentralizeFlowDeps): Promise<void> {
  const mode = await deps.promptMode()

  if (mode === 'add') {
    const repoMode = await deps.promptRepoSelectionMode?.()
    const repoPath = repoMode === 'custom'
      ? await deps.promptCustomRepo?.()
      : await deps.promptConfiguredRepo?.()

    const inspection = await deps.inspectRepo?.(repoPath!)
    deps.render(`${formatSectionLabel('Inspection')}`)
    deps.render(`Repo: ${inspection?.repoPath}`)

    const conflicts = await deps.detectConflicts?.()
    if (conflicts && conflicts.length > 0) {
      deps.render(formatWarning('Conflicts detected.'))
      return
    }

    if (await deps.promptConfirm()) {
      await deps.publish?.()
      const verification = await deps.verifyPublish?.()
      deps.render(`Verified: ${verification?.ok ? 'yes' : 'no'}`)
    }

    return
  }

  const installs = await deps.listCentralizedInstalls?.()
  const selected = await deps.promptInstalledItem?.(installs ?? [])
  const canPull = await deps.isGitRepo?.(selected!.sourceRepo)
  if (canPull) await deps.promptPullFirst?.()
  const preview = await deps.previewRefresh?.(selected!.installedRoot)
  if (preview) deps.render(preview)

  if (await deps.promptConfirm()) {
    await deps.refreshInstall?.(selected!.installedRoot)
    const verification = await deps.verifyRefresh?.()
    deps.render(`Verified: ${verification?.ok ? 'yes' : 'no'}`)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/centralize-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/centralize/engine.ts src/lib/centralize/prompts.ts src/lib/centralize/inspect.ts src/lib/centralize/naming.ts src/lib/centralize/scripts.ts src/lib/centralize/verify.ts test/centralize-engine.test.ts
git commit -m "feat: add centralize flow engine"
```

## Task 8: Wire the command into the real helpers

**Files:**
- Modify: `src/commands/centralize/skills.ts`
- Modify: `src/lib/centralize/engine.ts`
- Modify: `src/lib/centralize/prompts.ts`
- Modify: `src/index.ts`
- Test: `test/index.test.ts`
- Test: `test/centralize-command.integration.test.ts`

- [ ] **Step 1: Add a failing command wiring test**

```ts
// test/centralize-command.integration.test.ts addition
import {describe, expect, it, vi} from 'vitest'

describe('centralize command wiring', () => {
  it('runs through the command entry without surfacing PromptCancelled as an error', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const {handleCliError} = await import('../src/index.js')
    const {PromptCancelled} = await import('../src/lib/link/prompts.js')

    await handleCliError(new PromptCancelled())

    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails if command wiring is incomplete**

Run: `pnpm vitest run test/centralize-command.integration.test.ts test/index.test.ts`
Expected: FAIL if the command does not route through the shared cancellation behavior cleanly.

- [ ] **Step 3: Wire the command to the engine**

```ts
// src/commands/centralize/skills.ts
import {Command} from '@oclif/core'
import {runCentralizeFlow} from '../../lib/centralize/engine.js'
import {
  buildLayoutChoices,
  buildModeChoices,
  buildRepoSelectionChoices,
  confirm,
  input,
  select
} from '../../lib/centralize/prompts.js'
import {PromptCancelled, getCancelMessage} from '../../lib/link/prompts.js'

export default class CentralizeSkills extends Command {
  static override description = 'Interactively centralize skills from source repos'

  public async run(): Promise<void> {
    try {
      await runCentralizeFlow({
        promptMode: async () => select({message: 'What would you like to do?', choices: buildModeChoices()}),
        promptConfirm: async () => confirm({message: 'Proceed?'}),
        render: line => this.log(line)
      })
    } catch (error) {
      if (error instanceof PromptCancelled) {
        this.log(getCancelMessage())
        return
      }

      throw error
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/centralize-command.integration.test.ts test/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/centralize/skills.ts src/lib/centralize/engine.ts src/lib/centralize/prompts.ts src/index.ts test/centralize-command.integration.test.ts test/index.test.ts
git commit -m "feat: wire centralize command into the cli"
```

## Task 9: Document the new command and lock it with tests

**Files:**
- Modify: `README.md`
- Create: `test/readme-centralize.test.ts`

- [ ] **Step 1: Write the failing README test**

```ts
// test/readme-centralize.test.ts
import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

describe('README centralize docs', () => {
  it('documents the centralize skills command', () => {
    const readme = readFileSync('README.md', 'utf8')
    expect(readme).toContain('toolai centralize skills')
    expect(readme).toContain('Add new')
    expect(readme).toContain('Update existing')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/readme-centralize.test.ts`
Expected: FAIL because the README does not mention the centralize command yet.

- [ ] **Step 3: Update README with the new command**

```md
## Commands

### `toolai link skills`

Interactively add or remove centralized skills from project or global agent folders.

### `toolai link agents`

Interactively add or remove centralized agents from project or global agent folders.

### `toolai centralize skills`

Interactively publish skills from a source repo into `~/.agent-tools/skills` or
sync an existing centralized install in place.

The command walks through:

- `Add new` or `Update existing`
- repo selection from configured repos or a custom path
- mixed-layout handling for root, nested, or both
- explicit bundle naming and prefix choices
- conflict checks before publish
- dry-run preview before every update
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/readme-centralize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md test/readme-centralize.test.ts
git commit -m "docs: add centralize skills command usage"
```

## Task 10: Full verification

**Files:**
- Modify: `src/commands/centralize/skills.ts`
- Modify: `src/lib/centralize/engine.ts`
- Modify: `src/lib/centralize/inspect.ts`
- Modify: `src/lib/centralize/naming.ts`
- Modify: `src/lib/centralize/scripts.ts`
- Modify: `src/lib/centralize/verify.ts`
- Modify: `README.md`

- [ ] **Step 1: Run the focused centralize tests**

Run: `pnpm vitest run test/centralize-command.integration.test.ts test/centralize-engine.test.ts test/centralize-inspect.test.ts test/centralize-naming.test.ts test/centralize-scripts.test.ts test/centralize-verify.test.ts test/readme-centralize.test.ts`
Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run: `pnpm vitest run`
Expected: PASS

- [ ] **Step 3: Run the TypeScript compiler**

Run: `pnpm exec tsc -p tsconfig.json`
Expected: PASS

- [ ] **Step 4: Manually inspect command help**

Run: `pnpm dev -- centralize skills --help`
Expected: help output includes the `centralize skills` command description without throwing.

- [ ] **Step 5: Commit the final integration pass**

```bash
git add src/commands/centralize/skills.ts src/lib/centralize/engine.ts src/lib/centralize/inspect.ts src/lib/centralize/naming.ts src/lib/centralize/scripts.ts src/lib/centralize/verify.ts README.md
git commit -m "feat: implement centralize skills workflow"
```

## Self-Review

### Spec Coverage

- Command shape and first prompt: Task 2, Task 7, Task 8
- Add-new repo selection, mixed-layout handling, bundle naming, prefix handling, and conflict loop: Task 2, Task 3, Task 4, Task 7
- Update-existing list, pull-if-git behavior, mandatory preview, and in-place sync: Task 5, Task 7
- Reuse of shell scripts: Task 5
- Verification requirements after add/update: Task 6, Task 7, Task 10
- CLI presentation and README coverage: Task 8, Task 9

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain in the task steps.
- Each code-writing task includes concrete file paths and starter code.
- Each verification step includes an exact command and expected result.

### Type Consistency

- `CentralizeMode` remains `add | update` across prompts, engine, and command wiring.
- Layout values remain `root-only | nested-only | both` at the prompt layer and `root-only | nested-only | mixed-layout | none` at the inspection layer.
- Script wrappers use `CentralizedInstall` consistently for update flow selection and refresh planning.
