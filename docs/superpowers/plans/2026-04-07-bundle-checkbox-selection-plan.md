# Bundle + Checkbox Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace numeric text entry in `toolai link skills` and `toolai link agents` with space/enter checkbox selection, collapse bundled skills into bundle-level rows, and make prompt cancellation and output styling feel polished.

**Architecture:** Extend the existing shared link engine with a richer menu-entry model, a checkbox prompt layer, and a small presentation module for colors and formatted copy. Keep filesystem behavior in the adapters, keep selection state in the engine, and add a single SIGINT-safe exit path so prompt cancellation never leaks raw `ExitPromptError` output.

**Tech Stack:** TypeScript, oclif, @inquirer/prompts, Vitest, tsx, a lightweight color library if needed

---

## File Structure

Planned files and responsibilities:

- Modify: `src/lib/link/types.ts`
  - richer menu entry types for bundle rows, standalone rows, and styled target rows
- Modify: `src/lib/adapters/skills.ts`
  - collapse bundle members into bundle-level entries and expand them back during apply
- Modify: `src/lib/adapters/agents.ts`
  - adapt to checkbox-based selection and styled output structures
- Modify: `src/lib/link/prompts.ts`
  - checkbox prompts and graceful SIGINT handling
- Modify: `src/lib/link/engine.ts`
  - move from typed index entry to checkbox selection and summary rendering
- Modify: `src/lib/link/output.ts`
  - human-friendly labels for bundles plus formatted/colorized lines
- Create: `src/lib/link/theme.ts`
  - central place for colors, labels, and small presentation helpers
- Modify: `test/skills-adapter.test.ts`
  - bundle grouping and expansion coverage
- Modify: `test/agents-adapter.test.ts`
  - remove-flow and checkbox-facing expectations
- Modify: `test/link-engine.test.ts`
  - checkbox flow and SIGINT-safe behavior
- Modify: `test/link-skills.integration.test.ts`
  - bundle-level UX assertions
- Modify: `test/link-agents.integration.test.ts`
  - checkbox-driven agent UX assertions
- Create: `test/theme.test.ts`
  - formatting and friendly-cancel output checks

## Task 1: Model bundle-level skill entries

**Files:**
- Modify: `src/lib/link/types.ts`
- Modify: `src/lib/adapters/skills.ts`
- Modify: `test/skills-adapter.test.ts`

- [ ] **Step 1: Write the failing bundle grouping test**

```ts
it('returns one bundle row instead of one row per bundle member', async () => {
  const entries = await createSkillsAdapter(() => {}).discoverItems('project', 'add')
  const expoEntries = entries.filter(entry => entry.name === 'expo')

  expect(expoEntries).toHaveLength(1)
  expect(expoEntries[0]).toMatchObject({
    detail: 'bundle',
    kind: 'bundle'
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/skills-adapter.test.ts`
Expected: FAIL because the current adapter emits one row per alias such as `expo-api-routes`.

- [ ] **Step 3: Write minimal bundle-entry implementation**

```ts
// src/lib/link/types.ts
export interface DiscoveredItem {
  name: string
  marker: LinkMarker
  detail?: string
  kind?: 'item' | 'bundle'
  members?: string[]
}
```

```ts
// src/lib/adapters/skills.ts shape to introduce
{
  name: 'expo',
  marker: '[ ]',
  detail: 'bundle',
  kind: 'bundle',
  members: ['expo-api-routes', 'expo-dev-client']
}
```

The adapter should:
- emit one row per bundle using the bundle name
- keep standalone skills as individual rows
- compute bundle markers from the aggregate link state of bundle members
- expand bundle members only during apply

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/skills-adapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/link/types.ts src/lib/adapters/skills.ts test/skills-adapter.test.ts
git commit -m "feat: group skill bundles into bundle-level menu entries"
```

## Task 2: Replace typed selection with checkbox prompts

**Files:**
- Modify: `src/lib/link/prompts.ts`
- Modify: `src/lib/link/engine.ts`
- Modify: `test/link-engine.test.ts`

- [ ] **Step 1: Write the failing checkbox-flow test**

```ts
it('uses checkbox prompts for item and target selection', async () => {
  const events: string[] = []

  await runLinkFlow({
    adapter: {
      async discoverItems() {
        return [{name: 'expo', marker: '[ ]', detail: 'bundle', kind: 'bundle', members: ['expo-api-routes']}]
      },
      async discoverTargets() {
        return [{name: 'Codex', path: '.codex/skills', marker: '[ ]'}]
      },
      async apply() {
        events.push('apply')
        return []
      }
    },
    promptForScope: async () => 'project',
    promptForOperation: async () => 'add',
    promptForMultiSelect: async (_message, entries) => entries.map(entry => entry.name),
    render: () => undefined
  })

  expect(events).toEqual(['apply'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/link-engine.test.ts`
Expected: FAIL because the engine still calls the text-based selection prompt.

- [ ] **Step 3: Write minimal checkbox implementation**

```ts
// src/lib/link/prompts.ts
import {checkbox} from '@inquirer/prompts'

export async function promptForMultiSelect(
  message: string,
  choices: Array<{name: string; value: string; description?: string}>
): Promise<string[]> {
  return checkbox({message, choices})
}
```

```ts
// src/lib/link/engine.ts
const selectedItems = await options.promptForMultiSelect(
  'Select items',
  items.map(item => ({name: item.name, value: item.name, description: item.detail}))
)
```

The engine should no longer require users to type `1,4,7`. Selection should be space-to-toggle and enter-to-submit.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/link-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/link/prompts.ts src/lib/link/engine.ts test/link-engine.test.ts
git commit -m "feat: use checkbox prompts for interactive selection"
```

## Task 3: Add friendly SIGINT handling

**Files:**
- Modify: `src/lib/link/prompts.ts`
- Create: `test/theme.test.ts`

- [ ] **Step 1: Write the failing cancellation test**

```ts
it('returns a friendly cancellation message for Ctrl+C exits', async () => {
  await expect(handlePromptError(new Error('User force closed the prompt with SIGINT'))).resolves.toBe('Goodbye.')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/theme.test.ts`
Expected: FAIL because prompt cancellation is not normalized yet.

- [ ] **Step 3: Write minimal SIGINT-safe implementation**

```ts
// src/lib/link/prompts.ts
export function isPromptCancel(error: unknown): boolean {
  return error instanceof Error && error.message.includes('SIGINT')
}

export function getCancelMessage(): string {
  return 'Goodbye.'
}
```

Wrap all prompt entrypoints so they catch prompt cancellation and return or print the friendly message instead of raw `ExitPromptError`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/theme.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/link/prompts.ts test/theme.test.ts
git commit -m "feat: handle prompt cancellation gracefully"
```

## Task 4: Add a shared presentation theme

**Files:**
- Create: `src/lib/link/theme.ts`
- Modify: `src/lib/link/output.ts`
- Modify: `package.json`
- Modify: `test/theme.test.ts`

- [ ] **Step 1: Write the failing theme-format test**

```ts
it('formats bundle rows with a visible bundle label', () => {
  expect(formatBundleLabel('expo')).toContain('bundle')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/theme.test.ts`
Expected: FAIL because there is no shared theme module yet.

- [ ] **Step 3: Write minimal theme implementation**

```ts
// src/lib/link/theme.ts
export function formatBundleLabel(name: string): string {
  return `${name} (bundle)`
}

export function formatExitMessage(): string {
  return 'Goodbye.'
}
```

If a color package is needed, add one lightweight dependency and apply it only in `theme.ts`. Use it for:
- section headings
- status markers
- success/warning summary lines

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/theme.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json src/lib/link/theme.ts src/lib/link/output.ts test/theme.test.ts
git commit -m "feat: add colorized CLI presentation theme"
```

## Task 5: Integrate bundle rows, checkbox UI, and pretty output end-to-end

**Files:**
- Modify: `src/lib/adapters/skills.ts`
- Modify: `src/lib/adapters/agents.ts`
- Modify: `src/lib/link/engine.ts`
- Modify: `src/lib/link/output.ts`
- Modify: `src/commands/link/skills.ts`
- Modify: `src/commands/link/agents.ts`
- Modify: `test/link-skills.integration.test.ts`
- Modify: `test/link-agents.integration.test.ts`

- [ ] **Step 1: Write the failing integration assertions**

```ts
it('shows bundle-level choices such as expo instead of expo-api-routes', async () => {
  const module = await import('../src/commands/link/skills.js')
  expect(module.default.description).toContain('skill symlinks')
})
```

Add integration expectations that the rendered lines include:
- `expo (bundle)` or equivalent bundle-friendly label
- styled target rows
- friendly summary lines

- [ ] **Step 2: Run integration tests to verify they fail**

Run: `pnpm vitest run test/link-skills.integration.test.ts test/link-agents.integration.test.ts`
Expected: FAIL until bundle rendering and checkbox plumbing are complete.

- [ ] **Step 3: Implement the end-to-end integration**

Required behavior:
- `link skills` shows one row per bundle plus standalone skills
- users select with space/enter, not manual typed indexes
- `Ctrl+C` prints a short exit message and stops cleanly
- menu and summary output use the shared theme for polished formatting

- [ ] **Step 4: Run targeted integration tests**

Run: `pnpm vitest run test/link-skills.integration.test.ts test/link-agents.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/adapters/skills.ts src/lib/adapters/agents.ts src/lib/link/engine.ts src/lib/link/output.ts src/commands/link/skills.ts src/commands/link/agents.ts test/link-skills.integration.test.ts test/link-agents.integration.test.ts
git commit -m "feat: add bundle checkbox selection and polished CLI output"
```

## Task 6: Final verification and docs refresh

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-04-06-link-commands-design.md`

- [ ] **Step 1: Write the failing README assertion**

```ts
it('documents bundle-level and checkbox selection behavior', async () => {
  const readme = await readFile('README.md', 'utf8')
  expect(readme).toContain('space')
  expect(readme).toContain('bundle')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/readme.test.ts`
Expected: FAIL until the README describes the new interaction model.

- [ ] **Step 3: Update docs**

Document:
- bundle-level skill rows
- checkbox selection with space/enter
- friendly `Ctrl+C` behavior
- colorized output expectations

- [ ] **Step 4: Run full verification**

Run: `pnpm vitest run`
Expected: PASS

Run: `pnpm exec tsc -p tsconfig.json`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-04-06-link-commands-design.md test/readme.test.ts
git commit -m "docs: describe bundle and checkbox selection flow"
```

## Self-Review

1. Spec coverage: the plan covers bundle-level rows, checkbox selection, SIGINT handling, and CLI styling.
2. Placeholder scan: remove any incomplete pseudocode before execution begins.
3. Type consistency: keep `DiscoveredItem`, `TargetEntry`, bundle membership, and prompt result types aligned between adapters and engine.

Plan complete and saved to `docs/superpowers/plans/2026-04-07-bundle-checkbox-selection-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
