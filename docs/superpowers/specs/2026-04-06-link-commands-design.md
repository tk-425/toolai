# Link Commands Design

Date: 2026-04-06
Status: Ready for implementation

## Summary

Replace the existing `symlink-skills` and `symlink-agents` agent skills with
two interactive CLI commands:

- `toolai link skills`
- `toolai link agents`

These commands will own the entire user interaction flow in the terminal and
remove the need for token-heavy prompt-driven skill execution for these
workflows.

## Goals

- Replace the current skill-based symlink workflows with native CLI commands.
- Preserve the current interactive user experience.
- Support selecting multiple items and multiple target folders in a single run.
- Share the common interaction and selection logic between `skills` and
  `agents`.
- Keep the design open for future `toolai centralize skills` work without
  forcing it into the same abstraction.

## Non-Goals

- Support non-interactive flags such as `--project`, `--add`, or prefilled
  answers.
- Keep the existing `symlink-skills` and `symlink-agents` skills as wrappers.
- Fold `centralize-skills` into the same command family in the first pass.
- Add unrelated skill-management features in this design.

## User Experience

Both commands follow the same fixed interaction flow:

1. Prompt for scope: `project` or `global`
2. Prompt for operation: `add` or `remove`
3. Display available items with live state markers
4. Prompt for one or more item selections
5. Display eligible target folders
6. Prompt for one or more target folder selections
7. Apply symlink changes
8. Print grouped results

The commands should remain fully interactive. The user should not be able to
skip prompts by passing flags.

## Public CLI Shape

### Commands

- `toolai link skills`
- `toolai link agents`

### Future Command Family

Later work may introduce:

- `toolai centralize skills`

This should remain a separate workflow family because it performs source-repo
discovery, publish planning, copy operations, refresh flows, and verification,
which are materially different from simple link registration.

## Implementation Note

For initial project setup, prefer official scaffold commands over hand-written
bootstrap files. In practice, that means using package-manager and tool-native
initialization commands such as `pnpm init`, `oclif init`, and `tsc --init`
before patching the generated files to the project's final shape.

## Shared Link Engine

Implement one shared internal engine for interactive link management. The engine
should not know skill-specific or agent-specific discovery rules. It should
only coordinate the common workflow.

### Responsibilities

- render prompts and numbered menus
- format aligned item lists
- parse selections by number, range, exact name, and `all`
- support multi-select for items
- support multi-select for target folders
- aggregate link state across target folders
- render state markers:
  - `[✓]` linked everywhere in the current target set
  - `[-]` linked in some eligible targets
  - `[ ]` not linked
- execute add/remove operations through adapter callbacks
- print grouped confirmation output after mutation

### Operation Model

The engine supports exactly two operations:

- `add`
- `remove`

There is no `both` mode.

## Resource Adapters

Two adapters sit behind the shared engine.

### Skills Adapter

Source of truth:

- `~/.agent-tools/skills/`

Responsibilities:

- read global-skill exclusions
- detect bundles from top-level symlinks
- compute bundle member counts from matching top-level aliases
- detect standalone skills from real directories
- ignore hidden entries
- exclude bundle source directories from standalone results
- exclude global skills from menus and confirmations
- respect the `gstack` special case noted in current skill docs
- map scope to the correct target skill folders

Behavior should preserve the current documented rules from:

- `symlink-skills/SKILL.md`
- `symlink-skills/references/global-skills.md`
- `symlink-skills/references/bundles.md`
- `symlink-skills/references/agent-folders.md`

### Agents Adapter

Source of truth:

- `~/.agent-tools/agents/`

Responsibilities:

- discover available agents dynamically from top-level `*.md` files
- expose agent names without the `.md` suffix in menus
- map scope to the correct target agent folders
- symlink the `.md` file directly into the target folder

Behavior should preserve the current documented rules from:

- `symlink-agents/SKILL.md`
- `symlink-agents/references/agent-folders.md`

## Selection Rules

Item and target selection must support:

- a single number
- comma-separated numbers
- numeric ranges such as `1-4`
- exact names
- comma-separated names
- `all`

The command should reject invalid entries with a clear retry prompt rather than
trying to infer intent.

## Add Flow

### Skills

1. Discover available skills from the centralized skills directory.
2. Scan current link state across the target folders for the chosen scope.
3. Show bundles first, then standalone skills.
4. Allow selecting one or more skills or bundles.
5. Show the target agent folders for the chosen scope.
6. Allow selecting one or more target folders.
7. Create any missing target folder.
8. Create only missing symlinks.
9. Skip already-linked entries and report them.

### Agents

1. Discover available agents from top-level `*.md` files.
2. Scan current link state across the target folders for the chosen scope.
3. Show the available agents.
4. Allow selecting one or more agents.
5. Show the target tool folders for the chosen scope.
6. Allow selecting one or more target folders.
7. Create any missing target folder.
8. Create only missing symlinks.
9. Skip already-linked entries and report them.

## Remove Flow

### Skills

1. Scan the chosen scope for actually linked skills.
2. Exclude global skills from displayed results.
3. If nothing is linked, stop with a concise message.
4. Show only linked items.
5. Allow selecting one or more skills or bundles.
6. Show only target folders that contain at least one selected item.
7. Allow selecting one or more target folders.
8. Remove only symlinks.
9. Skip non-symlink entries with a warning.

### Agents

1. Scan the chosen scope for actually linked agent files.
2. If nothing is linked, stop with a concise message.
3. Show only linked agents.
4. Allow selecting one or more agents.
5. Show only target folders that contain at least one selected agent.
6. Allow selecting one or more target folders.
7. Remove only symlinks.
8. Skip non-symlink entries with a warning.

## Filesystem Rules

### Add

- Never overwrite an existing symlink.
- Never overwrite a real file or directory.
- Create target folders only when needed.
- For skills, create links from the top-level alias path, not a nested bundle
  path.
- For agents, link the `.md` file directly.

### Remove

- Remove only verified symlinks.
- Never remove a real file or directory.
- Use explicit symlink checks before removal.

## Output Format

Confirmation output should:

- include the selected scope
- group results by target folder
- mark successful additions or removals with `✓`
- mark skipped existing links or protected non-symlink entries distinctly

The output should stay compact and easy to scan.

## Error Handling

- If discovery yields no available items for the selected operation, print a
  concise message and stop.
- If the user enters an invalid selection, explain what failed and re-prompt.
- If a target path exists but is not a symlink where a symlink is expected,
  skip it and warn.
- If bundle detection finds malformed or unsafe entries, ignore them according
  to the current bundle rules.

## Architecture

Suggested internal split:

- command layer
  - parses `toolai link skills` and `toolai link agents`
- interactive link engine
  - shared workflow and menu handling
- resource adapters
  - `skills`
  - `agents`
- filesystem helpers
  - scan links
  - create symlink safely
  - remove symlink safely
- selection parser
  - names, lists, ranges, `all`

This keeps the user interaction consistent while isolating the item-specific
rules in narrow adapters.

## Testing Strategy

Focus tests on the deterministic logic first.

### Unit Tests

- selection parsing
- state marker calculation
- bundle detection
- global skill exclusion
- target filtering for remove flows
- path generation for add and remove operations

### Integration Tests

- `toolai link skills` add flow against temporary directories
- `toolai link skills` remove flow against temporary directories
- `toolai link agents` add flow against temporary directories
- `toolai link agents` remove flow against temporary directories
- non-symlink protection behavior
- `gstack` special-case preservation

### Deferred

- `toolai centralize skills`

This design intentionally does not cover that workflow beyond reserving the
command family shape for future work.

## Open Follow-Up

One additional skill-related feature is expected later. This design should not
block it, but it should also not pre-abstract around an unknown requirement.
That feature should be designed separately when ready.
