# Centralize Skills Design

Date: 2026-04-07
Status: Draft

## Summary

Add a new interactive CLI command:

- `toolai centralize skills`

This command replaces the current prompt-driven `centralize-skills` workflow
with a native terminal flow for publishing skills from source repos into the
central store at `~/.agent-tools/skills` and for syncing previously
centralized installs in place.

## Goals

- Replace the current `centralize-skills` agent skill with a native CLI
  command.
- Keep the workflow fully interactive, matching the style of `toolai link`.
- Support both `Add new` and `Update existing` in the first release.
- Preserve the current source-of-truth shell scripts where they already encode
  publish and refresh behavior.
- Make publish and update flows explicit, previewable, and verifiable.

## Non-Goals

- Support non-interactive flags or prefilled answers.
- Add a removal workflow for centralized installs in v1.
- Allow changing prefixes during `Update existing`.
- Force overwrite through naming conflicts.
- Reimplement the existing publish and refresh shell logic prematurely inside
  TypeScript.

## Public CLI Shape

### Command

- `toolai centralize skills`

### First Prompt

The command starts by asking the user to choose:

- `Add new`
- `Update existing`

Short descriptions should appear under each choice:

- `Add new`: copy skills from a source repo into the central store
- `Update existing`: sync an existing centralized install from its source repo

## User Experience

The command is always interactive. It does not accept flags that skip prompts.

The CLI should follow the same presentation style as `toolai link`:

- colorized output
- readable summaries before risky actions
- friendly cancellation on `Ctrl+C`
- clear confirmation output after success

## Add New Flow

### High-Level Flow

1. Ask how to choose the source repo:
   - configured repo list
   - custom repo path
2. Let the user select or enter the source repo.
3. Inspect the repo.
4. Show an inspection summary.
5. If layout is `mixed-layout`, ask the user to choose:
   - `Root only`
   - `Nested only`
   - `Both`
6. If the user chooses `Both`, show a warning that this will create:
   - one standalone installed root skill
   - one bundled install for the nested skills
   Then require an extra confirmation before continuing.
7. Ask the user how to name the bundle install when a bundle will be created:
   - use the default bundle name derived from the source repo basename
   - enter a custom bundle name
8. Ask the user how to handle prefix:
   - no prefix
   - suggested prefix
   - custom prefix
9. Detect naming conflicts in `~/.agent-tools/skills`.
10. If conflicts exist, block publish for the current naming plan, explain the
    conflict set, and let the user recover by choosing one of:
    - change bundle name
    - change prefix
    - choose a different source repo
    - cancel
    After revised choices, re-run conflict detection.
11. Show the publish plan.
12. Ask for confirmation.
13. Run publish.
14. Verify the installed result.

### Repo Source Selection

The command must support both repo discovery methods:

- choose from repo paths discovered through the existing centralize config
- enter a custom repo path manually

Configured repo discovery should remain the default guided path. Custom path
entry is the escape hatch.

### Skill Discovery Rules

Use the existing centralize workflow rules:

- a valid skill is any directory containing `SKILL.md`
- classify the selected repo as:
  - `root-only`
  - `nested-only`
  - `mixed-layout`

For `mixed-layout`, the CLI must always ask the user to choose one of:

- `Root only`
- `Nested only`
- `Both`

After the user chooses, continue discovery and planning using only the selected
subset.

### Mixed Layout Semantics

If the user chooses `Both`, the result is two installs:

- one standalone installed skill for the repo root
- one bundled install for the nested skills

Top-level symlinks at `~/.agent-tools/skills` are created only for the nested
bundle members. The standalone root skill remains a direct installed directory
and does not receive a top-level symlink.

Because `Both` creates two centralized representations from one source repo, the
CLI must show a warning and require an extra confirmation before continuing.

### Selection Granularity

`Add new` works at the repo-discovery level, not per-skill cherry-picking.

Once the repo and layout subset are chosen, the command centralizes the full
detected set for that selection. The user does not individually choose which
nested skills to publish.

### Bundle Naming Rules

When `Add new` will create a bundle install, the command must always make
bundle naming explicit.

The default bundle name is the selected source repo directory basename. The
prompt must allow:

- use the default bundle name
- enter a custom bundle name

The final chosen bundle name becomes part of the install identity and must be
stored in `.centralize-config.json`.

### Prefix Rules

Prefix choice is always explicit during `Add new`.

The prompt must allow:

- no prefix
- suggested prefix
- custom prefix

The chosen prefix becomes part of the install identity and must be stored in
the resulting `.centralize-config.json`.

### Conflict Rules

Before publish, detect whether any install roots or top-level aliased names
would collide with existing entries in `~/.agent-tools/skills`.

If conflicts exist:

- block publish for the current naming plan
- show the full set of conflicts
- do not offer force overwrite
- allow the user to revise bundle naming, prefix selection, or source repo
  choice within the same run
- re-run conflict detection after revised choices

The user must resolve the conflict by changing the `Add new` choices, most
commonly via prefix selection or a different source repo.

## Update Existing Flow

### High-Level Flow

1. List existing centralized installs.
2. Let the user choose one.
3. Read the selected install's `.centralize-config.json`.
4. Inspect the stored source repo path.
5. If the source path is a git repo, ask whether to pull first.
6. Always run a dry-run preview.
7. Show the preview summary.
8. Ask for confirmation.
9. Run the sync in place.
10. Verify the refreshed install.

### Update Identity Rules

`Update existing` is a strict in-place sync.

That means:

- keep the existing install root
- keep the existing prefix
- keep the existing identity as standalone or bundle
- refresh copied content from the stored source repo
- recreate or refresh top-level symlinks as needed for bundled installs

`Update existing` must not expose prefix editing. If the user wants a new
prefix, they must use `Add new` instead.

### Source Pull Prompt

Only show the `pull first` prompt when the stored source path is a git repo.

If the source path is not a git repo, skip that prompt and continue directly to
preview.

### Preview Rules

Preview is mandatory for every update.

The command must always run the equivalent dry-run refresh first, show the
expected changes, and then ask whether to proceed.

### Sync Rules

The real update step refreshes the centralized install in place.

It may:

- overwrite outdated copied files with current source versions
- remove centralized files that no longer exist in the source, if the refresh
  logic determines they should be removed
- refresh bundled top-level symlinks

If the stored source path is missing, unreadable, or otherwise invalid, the
command must stop with a clear error and not continue.

## Install Types and Identity

### Standalone Install

- one real copied skill directory in `~/.agent-tools/skills`
- no top-level symlink is created for that standalone skill

### Bundle Install

- one real copied bundle directory in `~/.agent-tools/skills`
- one top-level symlink is created for each bundle member

### Both From Mixed Layout

- one standalone root install
- one bundled nested install
- top-level symlinks only for the nested bundle members

This identity model must be preserved in both publish and update flows.

## Reuse of Existing Shell Scripts

The CLI should treat the existing shell scripts as the source of truth for
publish, list, and refresh behavior in v1.

Expected integrations:

- list existing installs through
  `~/.agent-tools/skills/centralize-skills/scripts/list_centralized_installs.sh`
- publish through
  `~/.agent-tools/skills/centralize-skills/scripts/publish_skills.sh`
- preview and refresh through
  `~/.agent-tools/skills/centralize-skills/scripts/refresh_skills.sh`

The TypeScript CLI should orchestrate:

- prompt flow
- source inspection
- summary rendering
- conflict detection
- script invocation
- post-action verification

It should not reimplement the existing publish/refresh file mutation logic
unless a later design explicitly replaces those scripts.

## Presentation

### Inspection Summary

After source repo inspection and before layout/prefix confirmation, show a
short summary including:

- selected repo path
- detected layout
- discovered root skill name, if present
- discovered nested skill count and names, if present
- likely install shape: standalone, bundle, or both
- current conflict status

This summary gives the user context before naming and publish decisions.

### Publish Plan

Before `Add new` confirmation, show a concise plan including:

- source repo
- chosen layout subset
- chosen prefix
- install roots that will be created
- top-level aliases that will be created, if any

### Update Plan

Before `Update existing` confirmation, show a concise plan including:

- selected centralized install
- stored source path
- whether a pull was run or skipped
- dry-run summary of changed, added, or removed files

### Cancellation

If the user presses `Ctrl+C`, exit cleanly with a short friendly message. Do
not show an error stack trace or treat user cancellation as a command failure.

## Verification

### After Add New

Verify:

- expected standalone or bundle directories exist in
  `~/.agent-tools/skills`
- top-level symlinks exist only for bundled skills
- `.centralize-config.json` was written to each installed root

Then print a concise success summary of what was installed.

### After Update Existing

Verify:

- the selected centralized install still exists
- refresh completed successfully
- bundled top-level symlinks still exist and point correctly
- the install remains consistent with its stored identity

Then print a concise sync summary of what changed.

## Error Handling

- If repo discovery yields no valid skills, stop with a clear message.
- If the selected custom repo path does not exist, stop with a clear message.
- If inspection detects unsupported or malformed conditions, explain what was
  found and stop safely.
- If conflicts are found during `Add new`, block publish and show them.
- If `.centralize-config.json` is missing or invalid during `Update existing`,
  stop with a clear message.
- If the underlying publish or refresh script fails, surface the failure
  clearly and do not claim success.

## Architecture

Suggested internal split:

- command entrypoint for `toolai centralize skills`
- interactive engine for add/update orchestration
- repo inspection helpers
- conflict detection helpers
- shell-script runner wrapper
- verification helpers
- shared themed output utilities

The command should share presentation primitives with `link` where helpful, but
its workflow orchestration should remain separate because the problem domain is
materially different.
