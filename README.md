# toolai

Interactive CLI for local agent and skill management.

## Commands

- `toolai link skills`
- `toolai link agents`

Both commands are fully interactive and prompt for, in order:

1. scope (project/global)
2. operation (add/remove)
3. source item(s) via checkbox selection with `space` and `enter`
4. target folders

`link skills` shows bundle rows such as `expo (bundle)` instead of listing every bundled skill as a separate top-level choice.

If you cancel a prompt with `Ctrl+C`, the CLI exits cleanly with a short goodbye message instead of printing a raw prompt stack trace.
