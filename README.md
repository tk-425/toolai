# toolai

Interactive CLI for managing AI coding agent skills and agents across multiple tools.

## What it does

AI coding agents (Claude Code, Gemini CLI, Cursor, Codex, etc.) each store skills and agents in their own directories. `toolai` lets you:

- **Link** skills/agents from a centralized store (`~/.agent-tools`) into any or all agent directories via symlinks
- **Centralize** skills from source repos into the shared store, with bundle and prefix support

Instead of manually copying or symlinking files per-agent, you get an interactive multi-select flow that handles everything.

## Prerequisites

- Node.js >= 18
- pnpm
- A populated `~/.agent-tools/skills/` directory (for link commands)
- Source repos with skills (for centralize commands)

## Installation

```bash
pnpm install
pnpm build
pnpm link --global
```

After linking, the `toolai` command is available globally.

## Commands

### `toolai link skills`

Interactively manage skill symlinks between `~/.agent-tools/skills` and agent skill directories.

Flow:
1. **Scope** — project or global
2. **Operation** — add or remove
3. **Select items** — checkbox selection with `space` to toggle, `enter` to confirm. Bundles appear as single rows (e.g., `expo (bundle)`)
4. **Select targets** — choose which agent directories to link into

Project targets: `.claude/skills`, `.codex/skills`, `.gemini/skills`, `.cursor/skills`, `.agents/skills`, `.opencode/skills`, `.qwen/skills`

Global targets: `~/.claude/skills`, `~/.claude2/skills`, `~/.claude3/skills`, `~/.code/skills`, `~/.codex/skills`, `~/.cursor/skills-cursor/`, `~/.gemini/skills`, `~/.gemini/antigravity/skills`, `~/.qwen/skills`

### `toolai link agents`

Same interactive flow as `link skills`, but for agent `.md` files between `~/.agent-tools/agents` and agent directories.

Targets mirror the skill targets (`.claude/agents`, `.codex/agents`, etc.).

### `toolai centralize skills`

Publish skills from source repos into the centralized `~/.agent-tools/skills` store.

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
    ├── centralize/           # inspect, naming, scripts, prompts, output
    ├── config/               # paths, targets, rules
    ├── fs/                   # symlink ops, path helpers
    └── link/                 # shared link engine, prompts, theme
```

## Graceful cancellation

Pressing `Ctrl+C` at any prompt exits cleanly with a goodbye message — no stack traces.
