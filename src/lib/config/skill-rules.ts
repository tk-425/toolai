export const GLOBAL_SKILLS = new Set([
  'crawl4ai',
  'discuss',
  'explore',
  'firecrawl',
  'optimize-skill',
  'symlink-agents',
  'symlink-skills',
  'web-fetch'
])

export const SKILL_TARGETS = {
  project: [
    {label: 'Claude Code', path: '.claude/skills'},
    {label: 'Codex', path: '.codex/skills'},
    {label: 'Gemini', path: '.gemini/skills'},
    {label: 'Cursor', path: '.cursor/skills'},
    {label: 'Antigravity', path: '.agents/skills'},
    {label: 'OpenCode', path: '.opencode/skills'},
    {label: 'Qwen', path: '.qwen/skills'}
  ],
  global: [
    {label: 'Claude Code', path: '~/.claude/skills'},
    {label: 'Claude Code 2', path: '~/.claude2/skills'},
    {label: 'Claude Code 3', path: '~/.claude3/skills'},
    {label: 'Code', path: '~/.code/skills'},
    {label: 'Codex', path: '~/.codex/skills'},
    {label: 'Cursor', path: '~/.cursor/skills-cursor/'},
    {label: 'Gemini', path: '~/.gemini/skills'},
    {label: 'Gemini Antigravity', path: '~/.gemini/antigravity/skills'},
    {label: 'Qwen', path: '~/.qwen/skills'}
  ]
} as const
