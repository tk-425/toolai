# toolai

Interactive CLI for managing AI coding agent skills and agents across multiple tools.

## What it does

AI coding agents (Claude Code, Gemini CLI, Cursor, Codex, etc.) each store skills and agents in their own directories. `toolai` lets you:

- **Link** skills/agents from your configured centralized store into any or all agent directories via symlinks
- **Centralize** skills from source repos into the shared store, with bundle and prefix support

Instead of manually copying or symlinking files per-agent, you get an interactive multi-select flow that handles everything.

## Prerequisites

- Node.js >= 18
- pnpm
- Run `toolai init` before using link or configured centralize flows
- Source repos with skills (for centralize commands)

## Installation

```bash
pnpm install
pnpm build
pnpm link --global
```

After linking, the `toolai` command is available globally.

## Commands

### Platform model

`toolai` treats platforms in two groups:

- **Built-in platforms** — Claude Code, Codex, Gemini, Cursor, Antigravity, OpenCode, and Qwen
- **Custom global platforms** — user-managed entries stored in `~/.toolai/config.yaml`

Scope rules:
- **Project scope** uses built-in platforms only
- **Global scope** uses built-in platforms plus any configured custom global platforms
- **Custom platforms are global-only** and do not participate in project scope

### `toolai init`

Bootstrap `~/.toolai/config.yaml` interactively.

It asks for:
1. central skills location
2. central agents location
3. default source-repo root for `toolai centralize skills` when using `Configured repos`
4. optional custom global platforms to add on top of the built-in defaults

If `toolai` is already initialized, it warns and asks whether you want to update the configuration.

Custom platform labels and base paths are validated during init:
- blank values are rejected and re-prompted
- duplicate custom labels warn before replacement

Built-in platforms remain managed by the CLI defaults:
- Claude Code
- Codex
- Gemini
- Cursor
- Antigravity
- OpenCode
- Qwen

Custom global platforms are stored in `~/.toolai/config.yaml` and layered on top of those defaults.

Example:

```bash
toolai init
```

### `toolai config platforms list`

List configured custom global platforms stored in `~/.toolai/config.yaml`.

This command does not list built-in defaults.

Example:

```bash
toolai config platforms list
```

### `toolai config platforms add`

Add a custom global platform without rerunning full `toolai init`.

The command prompts for:
- platform label
- platform base path

Blank values are rejected. If the label already exists in custom config, `toolai` warns before replacement.

Example:

```bash
toolai config platforms add
```

### `toolai config platforms remove`

Remove a configured custom global platform.

This command only removes custom global entries. Built-in defaults are not removable through this flow.

Example:

```bash
toolai config platforms remove
```

### `toolai link skills`

Interactively manage skill symlinks between your configured central skills location and agent skill directories.

Flow:
1. **Scope** — project or global
2. **Operation** — add or remove
3. **Select items** — checkbox selection with `space` to toggle, `enter` to confirm. Bundles appear as single rows (e.g., `expo (bundle)`)
4. **Select targets** — choose which agent directories to link into

Project targets: `.claude/skills`, `.codex/skills`, `.gemini/skills`, `.cursor/skills`, `.agents/skills`, `.opencode/skills`, `.qwen/skills`
Project scope is anchored to the directory where you run `toolai`. The built-in project target set is always shown, even before those platform folders exist, and targets are displayed relative to that current project directory (for example `.agents/skills`).
If no items are available, or everything is already linked in `add` mode, the flow exits with a message instead of opening an empty checkbox prompt.
Long item and target lists show a count plus arrow-key guidance when more entries are available than fit in the initial viewport.

Global targets come from the merged platform config:
- built-in defaults from the CLI
- plus any custom global platforms stored in `~/.toolai/config.yaml`

Custom platforms are not available in project scope.

### `toolai link agents`

Same interactive flow as `link skills`, but for agent `.md` files between your configured central agents location and agent directories.

Targets mirror the skill targets (`.claude/agents`, `.codex/agents`, etc.).
Like `link skills`, the flow exits early with a message when there are no selectable items for the chosen scope and operation.
Project-scope agent targets are also anchored to the directory where you run `toolai`, and the full built-in target set is available even before those folders exist on disk.
Long lists also show arrow-key guidance when the prompt is scrollable.

Project scope uses built-in platforms only. Global scope includes configured custom global platforms.

### `toolai centralize skills`

Publish skills from source repos into your configured central skills store.

`toolai` now owns the centralize runtime:
- shared config lives at `~/.toolai/config.yaml`
- publish, refresh, and install listing run natively in the CLI

`Configured repos` uses the repo root stored in `toolai init` under `centralize.skills-dirs`.

Example:

```bash
toolai centralize skills
```

Long interactive selection lists in this flow show a count plus arrow-key guidance when more choices are available off-screen.

Two modes:

**Add new** — walks through:
1. Choose source repo (from configured repos or custom path)
2. Repo inspection (detects root-only, nested, or mixed layouts)
3. Bundle naming (auto or custom, when repo has multiple skills)
4. Prefix selection (suggested default, custom, or none)
5. Conflict detection (warns about existing paths)
6. Dry-run preview
7. Publish with post-publish verification

**Update existing** — walks through:
1. Select a previously centralized install
2. Compare current state against source repo
3. Optionally pull latest from source
4. Preview diff (added/removed skills)
5. Apply update with verification

Bundle refreshes prune removed source skills from both the bundle directory and their top-level alias symlinks, but only for members owned by that install.

## Development

```bash
pnpm install       # install dependencies
pnpm dev           # run via tsx (no build needed)
pnpm build         # compile TypeScript to dist/
pnpm test          # run vitest
```

## Project structure

```
src/
├── commands/
│   ├── config/platforms/     # toolai config platforms {list,add,remove}
│   ├── link/skills.ts        # toolai link skills
│   ├── link/agents.ts        # toolai link agents
│   ├── centralize/skills.ts  # toolai centralize skills
│   └── init.ts               # toolai init
└── lib/
    ├── adapters/             # skill & agent discovery/apply logic
    ├── centralize/           # inspect, naming, native engine, prompts, output
    ├── config/               # toolai config parsing, platform prompts, targets
    ├── fs/                   # symlink ops, path helpers
    └── link/                 # shared link engine, prompts, theme
```

## Graceful cancellation

Pressing `Ctrl+C` at any prompt exits cleanly with a goodbye message — no stack traces.
