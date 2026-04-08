# toolai

Interactive CLI for local agent and skill management.

## Commands

- `toolai link skills`
- `toolai link agents`
- `toolai centralize skills`

Both commands are fully interactive and prompt for, in order:

1. scope (project/global)
2. operation (add/remove)
3. source item(s) via checkbox selection with `space` and `enter`
4. target folders

`link skills` shows bundle rows such as `expo (bundle)` instead of listing every bundled skill as a separate top-level choice.

If you cancel a prompt with `Ctrl+C`, the CLI exits cleanly with a short goodbye message instead of printing a raw prompt stack trace.

`toolai centralize skills` is also fully interactive and supports:

1. `Add new` or `Update existing`
2. repo selection from configured repos or a custom path
3. mixed-layout handling for root, nested, or both
4. explicit bundle naming and prefix choices
5. conflict checks before publish
6. dry-run preview before every update
