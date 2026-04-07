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
