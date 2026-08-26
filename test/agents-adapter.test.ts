import {afterEach, describe, expect, it, vi} from 'vitest'
import {toAgentName} from '../src/lib/adapters/agents.js'
import {targetVisible} from '../src/lib/adapters/helpers.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('agents adapter', () => {
  it('strips the md suffix for display names', () => {
    expect(toAgentName('explorer.md')).toBe('explorer')
  })

  it('uses config-backed platform targets for global agent links', async () => {
    vi.doMock('../src/lib/config/platform-targets.js', () => ({
      getAgentTargets: vi.fn().mockResolvedValue([
        {label: 'Claude Code', path: '~/.claude/agents', resolvedPath: '~/.claude/agents'},
        {label: 'Code', path: '~/.code/agents', resolvedPath: '~/.code/agents'}
      ])
    }))

    const {createAgentsAdapter} = await import('../src/lib/adapters/agents.js')
    const adapter = createAgentsAdapter(() => undefined)
    const targets = await adapter.discoverTargets('global', 'add', [])

    expect(targets.map(target => target.path)).toEqual(['~/.claude/agents', '~/.code/agents'])
  })

  it('uses project-root-anchored display paths with separate resolved paths', async () => {
    vi.doMock('../src/lib/config/platform-targets.js', () => ({
      getAgentTargets: vi.fn().mockResolvedValue([
        {label: 'Claude Code', path: '.claude/agents', resolvedPath: '/repo/.claude/agents'}
      ])
    }))

    const {createAgentsAdapter} = await import('../src/lib/adapters/agents.js')
    const adapter = createAgentsAdapter(() => undefined)
    const targets = await adapter.discoverTargets('project', 'add', [])

    expect(targets.map(target => target.path)).toEqual(['.claude/agents'])
  })

  it('shows only linked targets during remove flows', () => {
    expect(targetVisible('remove', 0)).toBe(false)
    expect(targetVisible('remove', 1)).toBe(true)
  })
})
