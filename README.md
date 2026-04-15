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

### `toolai init`

Bootstrap `~/.toolai/config.yaml` interactively.

It asks for:
1. central skills location
2. central agents location
3. default source-repo root for `toolai centralize skills` when using `Configured repos`

If `toolai` is already initialized, it warns and asks whether you want to update the configuration.

### `toolai link skills`

Interactively manage skill symlinks between your configured central skills location and agent skill directories.

Flow:
1. **Scope** — project or global
2. **Operation** — add or remove
3. **Select items** — checkbox selection with `space` to toggle, `enter` to confirm. Bundles appear as single rows (e.g., `expo (bundle)`)
4. **Select targets** — choose which agent directories to link into

Project targets: `.claude/skills`, `.codex/skills`, `.gemini/skills`, `.cursor/skills`, `.agents/skills`, `.opencode/skills`, `.qwen/skills`

Global targets: `~/.claude/skills`, `~/.claude2/skills`, `~/.claude3/skills`, `~/.code/skills`, `~/.codex/skills`, `~/.cursor/skills-cursor/`, `~/.gemini/skills`, `~/.gemini/antigravity/skills`, `~/.qwen/skills`

### `toolai link agents`

Same interactive flow as `link skills`, but for agent `.md` files between your configured central agents location and agent directories.

Targets mirror the skill targets (`.claude/agents`, `.codex/agents`, etc.).

### `toolai centralize skills`

Publish skills from source repos into your configured central skills store.

`toolai` now owns the centralize runtime:
- shared config lives at `~/.toolai/config.yaml`
- publish, refresh, and install listing run natively in the CLI

`Configured repos` uses the repo root stored in `toolai init` under `centralize.skills-dirs`.

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
│   ├── link/skills.ts        # toolai link skills
│   ├── link/agents.ts        # toolai link agents
│   └── centralize/skills.ts  # toolai centralize skills
└── lib/
    ├── adapters/             # skill & agent discovery/apply logic
    ├── centralize/           # inspect, naming, native engine, prompts, output
    ├── config/               # paths, targets, rules
    ├── fs/                   # symlink ops, path helpers
    └── link/                 # shared link engine, prompts, theme
```

## Graceful cancellation

Pressing `Ctrl+C` at any prompt exits cleanly with a goodbye message — no stack traces.
