import {describe, expect, it} from 'vitest'
import {buildPlatformTargets} from '../src/lib/config/platform-targets.js'
import {DEFAULT_PLATFORM_CONFIG} from '../src/lib/config/toolai-config.js'

describe('platform targets', () => {
  it('derives global skill and agent targets from shared platform config', async () => {
    await expect(buildPlatformTargets('global', 'skills', [
      {label: 'Claude Code', base: '~/.claude'},
      {label: 'Code', base: '~/.code'}
    ])).resolves.toEqual([
      {label: 'Claude Code', path: '~/.claude/skills', resolvedPath: '~/.claude/skills'},
      {label: 'Code', path: '~/.code/skills', resolvedPath: '~/.code/skills'}
    ])

    await expect(buildPlatformTargets('global', 'agents', [
      {label: 'Claude Code', base: '~/.claude'}
    ])).resolves.toEqual([
      {label: 'Claude Code', path: '~/.claude/agents', resolvedPath: '~/.claude/agents'}
    ])
  })

  it('nests Pi and OMP global targets under agent/', async () => {
    const skills = await buildPlatformTargets('global', 'skills', DEFAULT_PLATFORM_CONFIG)
    expect(skills).toContainEqual({label: 'Pi', path: '~/.pi/agent/skills', resolvedPath: '~/.pi/agent/skills'})
    expect(skills).toContainEqual({label: 'OMP', path: '~/.omp/agent/skills', resolvedPath: '~/.omp/agent/skills'})

    const agents = await buildPlatformTargets('global', 'agents', DEFAULT_PLATFORM_CONFIG)
    expect(agents).toContainEqual({label: 'Pi', path: '~/.pi/agent/agents', resolvedPath: '~/.pi/agent/agents'})
    expect(agents).toContainEqual({label: 'OMP', path: '~/.omp/agent/agents', resolvedPath: '~/.omp/agent/agents'})
  })

  it('derives Grok global skill and agent targets from the shared registry', async () => {
    const skills = await buildPlatformTargets('global', 'skills', DEFAULT_PLATFORM_CONFIG)
    const agents = await buildPlatformTargets('global', 'agents', DEFAULT_PLATFORM_CONFIG)
    expect(skills).toContainEqual({label: 'Grok', path: '~/.grok/skills', resolvedPath: '~/.grok/skills'})
    expect(agents).toContainEqual({label: 'Grok', path: '~/.grok/agents', resolvedPath: '~/.grok/agents'})
  })

  it('always returns the full built-in project target set and excludes custom platforms', async () => {
    await expect(buildPlatformTargets('project', 'skills', [
      {label: 'Claude Code', base: '~/.claude'},
      {label: 'Agents', base: '~/.agents'},
      {label: 'Code', base: '~/.code'}
    ], async () => false, '/repo')).resolves.toEqual([
      {label: 'Claude Code', path: '.claude/skills', resolvedPath: '/repo/.claude/skills'},
      {label: 'Codex', path: '.codex/skills', resolvedPath: '/repo/.codex/skills'},
      {label: 'Gemini', path: '.gemini/skills', resolvedPath: '/repo/.gemini/skills'},
      {label: 'Cursor', path: '.cursor/skills', resolvedPath: '/repo/.cursor/skills'},
      {label: 'Agents', path: '.agents/skills', resolvedPath: '/repo/.agents/skills'},
      {label: 'OpenCode', path: '.opencode/skills', resolvedPath: '/repo/.opencode/skills'},
      {label: 'Qwen', path: '.qwen/skills', resolvedPath: '/repo/.qwen/skills'},
      {label: 'Grok', path: '.grok/skills', resolvedPath: '/repo/.grok/skills'},
      {label: 'Pi', path: '.pi/skills', resolvedPath: '/repo/.pi/skills'},
      {label: 'OMP', path: '.omp/skills', resolvedPath: '/repo/.omp/skills'}
    ])

    await expect(buildPlatformTargets('project', 'agents', [
      {label: 'Claude Code', base: '~/.claude'},
      {label: 'Code', base: '~/.code'}
    ], async () => false, '/repo')).resolves.toContainEqual(
      {label: 'Grok', path: '.grok/agents', resolvedPath: '/repo/.grok/agents'}
    )
  })

  it('anchors project targets to the current working directory', async () => {
    await expect(buildPlatformTargets('project', 'skills', [
      {label: 'Claude Code', base: '~/.claude'}
    ], async () => false, '/repo/src/lib')).resolves.toEqual([
      {label: 'Claude Code', path: '.claude/skills', resolvedPath: '/repo/src/lib/.claude/skills'},
      {label: 'Codex', path: '.codex/skills', resolvedPath: '/repo/src/lib/.codex/skills'},
      {label: 'Gemini', path: '.gemini/skills', resolvedPath: '/repo/src/lib/.gemini/skills'},
      {label: 'Cursor', path: '.cursor/skills', resolvedPath: '/repo/src/lib/.cursor/skills'},
      {label: 'Agents', path: '.agents/skills', resolvedPath: '/repo/src/lib/.agents/skills'},
      {label: 'OpenCode', path: '.opencode/skills', resolvedPath: '/repo/src/lib/.opencode/skills'},
      {label: 'Qwen', path: '.qwen/skills', resolvedPath: '/repo/src/lib/.qwen/skills'},
      {label: 'Grok', path: '.grok/skills', resolvedPath: '/repo/src/lib/.grok/skills'},
      {label: 'Pi', path: '.pi/skills', resolvedPath: '/repo/src/lib/.pi/skills'},
      {label: 'OMP', path: '.omp/skills', resolvedPath: '/repo/src/lib/.omp/skills'}
    ])
  })

  it('does not switch project scope to an ancestor with more built-in targets', async () => {
    await expect(buildPlatformTargets('project', 'skills', [
      {label: 'Claude Code', base: '~/.claude'},
      {label: 'Codex', base: '~/.codex'},
      {label: 'Gemini', base: '~/.gemini'},
      {label: 'Cursor', base: '~/.cursor'},
      {label: 'Agents', base: '~/.agents'},
      {label: 'OpenCode', base: '~/.opencode'},
      {label: 'Qwen', base: '~/.qwen'},
      {label: 'Code', base: '~/.code'}
    ], async () => true, '/Users/me/project/src/lib')).resolves.toEqual([
      {label: 'Claude Code', path: '.claude/skills', resolvedPath: '/Users/me/project/src/lib/.claude/skills'},
      {label: 'Codex', path: '.codex/skills', resolvedPath: '/Users/me/project/src/lib/.codex/skills'},
      {label: 'Gemini', path: '.gemini/skills', resolvedPath: '/Users/me/project/src/lib/.gemini/skills'},
      {label: 'Cursor', path: '.cursor/skills', resolvedPath: '/Users/me/project/src/lib/.cursor/skills'},
      {label: 'Agents', path: '.agents/skills', resolvedPath: '/Users/me/project/src/lib/.agents/skills'},
      {label: 'OpenCode', path: '.opencode/skills', resolvedPath: '/Users/me/project/src/lib/.opencode/skills'},
      {label: 'Qwen', path: '.qwen/skills', resolvedPath: '/Users/me/project/src/lib/.qwen/skills'},
      {label: 'Grok', path: '.grok/skills', resolvedPath: '/Users/me/project/src/lib/.grok/skills'},
      {label: 'Pi', path: '.pi/skills', resolvedPath: '/Users/me/project/src/lib/.pi/skills'},
      {label: 'OMP', path: '.omp/skills', resolvedPath: '/Users/me/project/src/lib/.omp/skills'}
    ])
  })
})
