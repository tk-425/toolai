import {afterEach, describe, expect, it, vi} from 'vitest'
import type {RemovalTarget} from '../src/lib/centralize/types.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('centralize prompts', () => {
  it('adds count and guidance to select prompts', async () => {
    const select = vi.fn().mockResolvedValue('value')

    vi.doMock('@inquirer/prompts', () => ({
      checkbox: vi.fn(),
      confirm: vi.fn(),
      input: vi.fn(),
      select
    }))

    const {promptSelect} = await import('../src/lib/centralize/prompts.js')

    await promptSelect(
      'Which centralized install would you like to update?',
      Array.from({length: 12}, (_, index) => ({name: `Install ${index}`, value: `install-${index}` as const}))
    )

    expect(select).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Which centralized install would you like to update? (12 available, use arrow keys to see more if needed)',
      pageSize: 10
    }))
  })

  it('builds mode choices including remove and two-level removal choices', async () => {
    const {buildModeChoices, buildRemovalBundleChoices, buildRemovalInstallChoices, removalTargetValue} = await import('../src/lib/centralize/prompts.js')

    const modes = buildModeChoices()
    expect(modes.map(mode => mode.value)).toEqual(['add', 'update', 'remove'])
    expect(modes.find(mode => mode.value === 'remove')?.name).toBe('Remove existing')

    const installs: RemovalTarget[] = [
      {kind: 'standalone', name: 'agent-flow'},
      {kind: 'bundle', name: 'superpowers'},
      {kind: 'standalone', name: 'archify'},
      {kind: 'bundle', name: 'task-run'}
    ]
    const installChoices = buildRemovalInstallChoices(installs)
    expect(installChoices.map(choice => choice.value)).toEqual([
      'bundle:superpowers',
      'bundle:task-run',
      'standalone:agent-flow',
      'standalone:archify'
    ])
    expect(installChoices.map(choice => choice.name)).toEqual([
      '[Bundle] superpowers',
      '[Bundle] task-run',
      '[Standalone] agent-flow',
      '[Standalone] archify'
    ])

    const bundle: RemovalTarget = {kind: 'bundle', name: 'bundle-pack'}
    const members: RemovalTarget[] = [
      {kind: 'skill-in-bundle', name: 'pref-alpha', bundleName: 'bundle-pack'},
      {kind: 'skill-in-bundle', name: 'pref-beta', bundleName: 'bundle-pack'}
    ]
    const bundleChoices = buildRemovalBundleChoices(bundle, members)
    expect(bundleChoices.map(choice => choice.value)).toEqual([
      'bundle:bundle-pack',
      'skill-in-bundle:bundle-pack:pref-alpha',
      'skill-in-bundle:bundle-pack:pref-beta'
    ])
    expect(bundleChoices[0].name).toBe('Remove entire bundle')
    expect(removalTargetValue(members[0])).toBe('skill-in-bundle:bundle-pack:pref-alpha')
  })
})
