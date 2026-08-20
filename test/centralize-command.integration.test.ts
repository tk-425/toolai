import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach, describe, expect, it, vi} from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.doUnmock('../src/lib/centralize/engine.js')
  vi.resetModules()
})

describe('centralize skills command', () => {
  it('exports the interactive command class', async () => {
    const command = await import('../src/commands/centralize/skills.js')
    expect(command.default).toBeDefined()
    expect(command.default.description).toContain('centralize')
  })

  it('parses publish preview json after a running-line prefix', async () => {
    const {parsePublishPreview} = await import('../src/lib/centralize/scripts.js')
    const preview = parsePublishPreview([
      'Running: bash /path/publish_skills.sh --dry-run /repo bundle prefix',
      '{',
      '  "mode": "multi-skill-bundle-with-symlinks",',
      '  "dryRun": true,',
      '  "bundleName": "bundle",',
      '  "prefix": "prefix-",',
      '  "discoveredSkills": ["a"],',
      '  "installedSkills": ["prefix-a"],',
      '  "publishedTo": "/central/bundle"',
      '}'
    ].join('\n'))

    expect(preview).toEqual(expect.objectContaining({
      mode: 'multi-skill-bundle-with-symlinks',
      bundleName: 'bundle',
      prefix: 'prefix-'
    }))
  })

  it('parses publish preview json with trailing noise and braces inside strings', async () => {
    const {parsePublishPreview} = await import('../src/lib/centralize/scripts.js')
    const preview = parsePublishPreview([
      'Running: publish preview',
      '{"mode":"multi-skill-bundle-with-symlinks","dryRun":true,"bundleName":"bundle","prefix":"prefix-","discoveredSkills":["a"],"installedSkills":["prefix-a"],"publishedTo":"/central/bundle-{1}"}',
      'done'
    ].join('\n'))

    expect(preview).toEqual(expect.objectContaining({
      bundleName: 'bundle',
      publishedTo: '/central/bundle-{1}'
    }))
  })

  it('re-previews after pull and prompts to update when new changes arrive', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-update-'))
    const installRoot = join(root, 'agent-skills')

    await mkdir(installRoot, {recursive: true})
    await writeFile(
      join(installRoot, '.centralize-config.json'),
      JSON.stringify({
        mode: 'multi-skill-bundle-with-symlinks',
        sourceRepo: '/repo/vercel-labs/agent-skills',
        bundleName: 'agent-skills',
        prefix: 'vercel-',
        installedSkills: ['vercel-a']
      })
    )

    const promptSelect = vi.fn().mockResolvedValue(installRoot)
    const promptConfirm = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
    const spinnerEvents: string[] = []
    const runRefresh = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({
        mode: 'multi-skill-bundle-with-symlinks',
        dryRun: true,
        bundleName: 'agent-skills',
        prefix: 'vercel-',
        discoveredSkills: ['a', 'b'],
        installedSkills: ['vercel-a', 'vercel-b'],
        contentChangedSkills: [],
        publishedTo: installRoot
      }))
      .mockResolvedValueOnce('')

    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptSelect,
      promptConfirm,
      promptInput: vi.fn(),
      buildModeChoices: vi.fn(),
      buildRepoSelectionChoices: vi.fn()
    }))
    vi.doMock('../src/lib/terminal/spinner.js', () => ({
      withSpinner: vi.fn(async (message: string, operation: () => Promise<unknown>) => {
        spinnerEvents.push(`start:${message}`)
        const result = await operation()
        spinnerEvents.push(`cleanup:${message}`)
        return result
      })
    }))
    vi.doMock('../src/lib/centralize/engine.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/engine.js')>('../src/lib/centralize/engine.js')
      return {
        ...actual,
        resolveCentralizedSourceRepo: vi.fn().mockResolvedValue('/repo/vercel-labs/agent-skills')
      }
    })
    vi.doMock('../src/lib/centralize/scripts.js', () => ({
      listCentralizedInstalls: vi.fn().mockResolvedValue([{
        kind: 'bundle',
        mode: 'multi-skill-bundle-with-symlinks',
        name: 'agent-skills',
        prefix: 'vercel-',
        sourceRepo: '/repo/vercel-labs/agent-skills',
        installedRoot: installRoot
      }]),
      inspectUpstreamStatus: vi.fn().mockResolvedValue({state: 'behind', behindCount: 1, upstreamRef: 'origin/main'}),
      parsePublishPreview: (output: string) => JSON.parse(output),
      pullLatest: vi.fn().mockResolvedValue('Updating old..new'),
      runPublish: vi.fn(),
      runRefresh
    }))
    vi.doMock('../src/lib/centralize/inspect.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/inspect.js')>('../src/lib/centralize/inspect.js')
      return {
        ...actual,
        inspectRepo: vi.fn().mockResolvedValue({isGitRepo: true})
      }
    })
    vi.doMock('../src/lib/centralize/verify.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/verify.js')>('../src/lib/centralize/verify.js')
      return {
        ...actual,
        verifyInstallContentMatchesSource: vi.fn().mockResolvedValue({ok: true, checkedPaths: [installRoot], failures: []})
      }
    })

    try {
      const commandModule = await import('../src/commands/centralize/skills.js')
      const command = new commandModule.default([], {} as never)
      const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

      await command.run()

      expect(promptConfirm).toHaveBeenCalledTimes(2)
      expect(promptConfirm).toHaveBeenNthCalledWith(1, 'Pull latest changes from the source repo before previewing centralized changes?')
      expect(promptConfirm).toHaveBeenNthCalledWith(2, 'Proceed with update?')
      expect(spinnerEvents.indexOf('cleanup:Checking source repo updates')).toBeLessThan(spinnerEvents.indexOf('start:Pulling latest source changes'))
      expect(spinnerEvents.indexOf('cleanup:Pulling latest source changes')).toBeLessThan(spinnerEvents.indexOf('start:Previewing centralized changes'))
      expect(spinnerEvents.indexOf('cleanup:Previewing centralized changes')).toBeLessThan(spinnerEvents.indexOf('start:Refreshing centralized changes'))
      expect(runRefresh).toHaveBeenNthCalledWith(1, installRoot, true)
      expect(runRefresh).toHaveBeenNthCalledWith(2, installRoot, false)
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Updating old..new'))
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Sync complete'))
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Centralized copy matches local source repo'))
      expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Centralized install unchanged'))
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('does not re-preview after pull when the repo is already up to date', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-update-noop-'))
    const installRoot = join(root, 'agent-skills')

    await mkdir(installRoot, {recursive: true})
    await writeFile(
      join(installRoot, '.centralize-config.json'),
      JSON.stringify({
        mode: 'multi-skill-bundle-with-symlinks',
        sourceRepo: '/repo/vercel-labs/agent-skills',
        bundleName: 'agent-skills',
        prefix: 'vercel-',
        installedSkills: ['vercel-a']
      })
    )

    const promptSelect = vi.fn()
      .mockResolvedValueOnce('update')
      .mockResolvedValueOnce(installRoot)
    const promptConfirm = vi.fn().mockResolvedValueOnce(true)
    const runRefresh = vi.fn().mockResolvedValueOnce(JSON.stringify({
      mode: 'multi-skill-bundle-with-symlinks',
      dryRun: true,
      bundleName: 'agent-skills',
      prefix: 'vercel-',
      discoveredSkills: ['a'],
      installedSkills: ['vercel-a'],
      contentChangedSkills: [],
      publishedTo: installRoot
    }))

    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptSelect,
      promptConfirm,
      promptInput: vi.fn(),
      buildModeChoices: vi.fn(),
      buildRepoSelectionChoices: vi.fn()
    }))
    vi.doMock('../src/lib/centralize/scripts.js', () => ({
      listCentralizedInstalls: vi.fn().mockResolvedValue([{
        kind: 'bundle',
        mode: 'multi-skill-bundle-with-symlinks',
        name: 'agent-skills',
        prefix: 'vercel-',
        sourceRepo: '/repo/vercel-labs/agent-skills',
        installedRoot: installRoot
      }]),
      inspectUpstreamStatus: vi.fn().mockResolvedValue({state: 'up_to_date', behindCount: 0, upstreamRef: 'origin/main'}),
      parsePublishPreview: (output: string) => JSON.parse(output),
      pullLatest: vi.fn().mockResolvedValue('Already up to date.'),
      runPublish: vi.fn(),
      runRefresh
    }))
    vi.doMock('../src/lib/centralize/inspect.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/inspect.js')>('../src/lib/centralize/inspect.js')
      return {
        ...actual,
        inspectRepo: vi.fn().mockResolvedValue({isGitRepo: true})
      }
    })

    try {
      const commandModule = await import('../src/commands/centralize/skills.js')
      const command = new commandModule.default([], {} as never)
      const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

      await command.run()

      expect(runRefresh).toHaveBeenCalledTimes(1)
      expect(promptConfirm).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Source repo is already up to date with remote'))
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Centralized install unchanged'))
      expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Already up to date.'))
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('shows the configured repo root once and shortens update choices under that root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-display-'))
    const installRoot = join(root, 'agent-skills')
    const configuredRepoRoot = '/Users/terrykang/Documents/Github-Repo/+Synced-Skills'
    const sourceRepo = `${configuredRepoRoot}/vercel-labs/agent-skills`

    await mkdir(installRoot, {recursive: true})
    await writeFile(
      join(installRoot, '.centralize-config.json'),
      JSON.stringify({
        mode: 'multi-skill-bundle-with-symlinks',
        sourceRepo,
        bundleName: 'agent-skills',
        prefix: 'vercel-',
        installedSkills: ['vercel-a']
      })
    )

    const promptSelect = vi.fn()
      .mockResolvedValueOnce('update')
      .mockResolvedValueOnce(installRoot)
    const promptConfirm = vi.fn().mockResolvedValueOnce(false)

    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptSelect,
      promptConfirm,
      promptInput: vi.fn(),
      buildModeChoices: vi.fn().mockReturnValue([]),
      buildRepoSelectionChoices: vi.fn()
    }))
    vi.doMock('../src/lib/config/toolai-config.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/config/toolai-config.js')>('../src/lib/config/toolai-config.js')
      return {
        ...actual,
        getConfiguredCentralizeRepoRoot: vi.fn().mockResolvedValue(configuredRepoRoot),
        getConfiguredSkillsRoot: vi.fn().mockResolvedValue('/central/skills')
      }
    })
    vi.doMock('../src/lib/centralize/engine.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/engine.js')>('../src/lib/centralize/engine.js')
      return {
        ...actual,
        resolveCentralizedSourceRepo: vi.fn().mockResolvedValue(sourceRepo)
      }
    })
    vi.doMock('../src/lib/centralize/scripts.js', () => ({
      listCentralizedInstalls: vi.fn().mockResolvedValue([{ 
        kind: 'bundle',
        mode: 'multi-skill-bundle-with-symlinks',
        name: 'agent-skills',
        prefix: 'vercel-',
        sourceRepo,
        installedRoot: installRoot
      }]),
      inspectUpstreamStatus: vi.fn().mockResolvedValue({state: 'no_upstream'}),
      parsePublishPreview: (output: string) => JSON.parse(output),
      pullLatest: vi.fn(),
      runPublish: vi.fn(),
      runRefresh: vi.fn().mockResolvedValue(JSON.stringify({
        mode: 'multi-skill-bundle-with-symlinks',
        dryRun: true,
        bundleName: 'agent-skills',
        prefix: 'vercel-',
        discoveredSkills: ['a'],
        installedSkills: ['vercel-a'],
        contentChangedSkills: [],
        publishedTo: installRoot
      }))
    }))
    vi.doMock('../src/lib/centralize/inspect.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/inspect.js')>('../src/lib/centralize/inspect.js')
      return {
        ...actual,
        inspectRepo: vi.fn().mockResolvedValue({isGitRepo: true})
      }
    })

    try {
      const commandModule = await import('../src/commands/centralize/skills.js')
      const command = new commandModule.default([], {} as never)
      const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

      await command.run()

      expect(log).toHaveBeenCalledWith(expect.stringContaining(configuredRepoRoot))
      expect(log).toHaveBeenCalledWith(expect.stringContaining('no upstream tracking branch'))
      expect(promptSelect).toHaveBeenNthCalledWith(
        2,
        'Which centralized install would you like to update?',
        expect.arrayContaining([
          expect.objectContaining({
            value: installRoot,
            name: expect.stringContaining('/vercel-labs/agent-skills')
          })
        ])
      )
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('groups update choices by install kind and preserves the selected install root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-order-'))
    const selectedRoot = join(root, 'bundle-alpha')
    const installs = [
      {
        kind: 'standalone' as const,
        mode: 'single-skill-direct-install' as const,
        name: 'zeta',
        prefix: '',
        sourceRepo: '/repo/zeta',
        installedRoot: join(root, 'zeta')
      },
      {
        kind: 'bundle' as const,
        mode: 'multi-skill-bundle-with-symlinks' as const,
        name: 'zeta-bundle',
        prefix: '',
        sourceRepo: '/repo/zeta-bundle',
        installedRoot: join(root, 'bundle-zeta')
      },
      {
        kind: 'standalone' as const,
        mode: 'single-skill-direct-install' as const,
        name: 'alpha',
        prefix: '',
        sourceRepo: '/repo/alpha',
        installedRoot: join(root, 'alpha')
      },
      {
        kind: 'bundle' as const,
        mode: 'multi-skill-bundle-with-symlinks' as const,
        name: 'alpha-bundle',
        prefix: '',
        sourceRepo: '/repo/alpha-bundle',
        installedRoot: selectedRoot
      }
    ]

    await mkdir(selectedRoot, {recursive: true})
    await writeFile(join(selectedRoot, '.centralize-config.json'), JSON.stringify({
      mode: 'multi-skill-bundle-with-symlinks',
      bundleName: 'alpha-bundle',
      prefix: '',
      installedSkills: ['alpha']
    }))

    const promptSelect = vi.fn()
      .mockResolvedValueOnce('update')
      .mockResolvedValueOnce(selectedRoot)
    const promptConfirm = vi.fn().mockResolvedValueOnce(false)
    const runRefresh = vi.fn().mockResolvedValueOnce(JSON.stringify({
      mode: 'multi-skill-bundle-with-symlinks',
      dryRun: true,
      bundleName: 'alpha-bundle',
      prefix: '',
      discoveredSkills: ['alpha'],
      installedSkills: ['alpha'],
      contentChangedSkills: ['alpha'],
      publishedTo: selectedRoot
    }))

    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptSelect,
      promptConfirm,
      promptInput: vi.fn(),
      buildModeChoices: vi.fn(),
      buildRepoSelectionChoices: vi.fn()
    }))
    vi.doMock('../src/lib/centralize/scripts.js', () => ({
      listCentralizedInstalls: vi.fn().mockResolvedValue(installs),
      inspectUpstreamStatus: vi.fn().mockResolvedValue({state: 'no_upstream'}),
      parsePublishPreview: (output: string) => JSON.parse(output),
      pullLatest: vi.fn(),
      runPublish: vi.fn(),
      runRefresh
    }))
    vi.doMock('../src/lib/centralize/engine.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/engine.js')>('../src/lib/centralize/engine.js')
      return {...actual, resolveCentralizedSourceRepo: vi.fn().mockResolvedValue('/repo/alpha-bundle')}
    })
    vi.doMock('../src/lib/centralize/inspect.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/inspect.js')>('../src/lib/centralize/inspect.js')
      return {...actual, inspectRepo: vi.fn().mockResolvedValue({isGitRepo: false, hasWorkingTreeChanges: false})}
    })

    try {
      const commandModule = await import('../src/commands/centralize/skills.js')
      const command = new commandModule.default([], {} as never)
      vi.spyOn(command, 'log').mockImplementation(() => undefined)

      await command.run()

      const choices = promptSelect.mock.calls[1][1] as Array<{name: string; value: string}>
      expect(choices.map(choice => choice.name)).toEqual([
        '[Bundle] alpha-bundle prefix: "" /repo/alpha-bundle',
        '[Bundle] zeta-bundle prefix: "" /repo/zeta-bundle',
        '[Standalone] alpha prefix: "" /repo/alpha',
        '[Standalone] zeta prefix: "" /repo/zeta'
      ])
      expect(choices.map(choice => choice.value)).toEqual([
        selectedRoot,
        join(root, 'bundle-zeta'),
        join(root, 'alpha'),
        join(root, 'zeta')
      ])
      expect(runRefresh).toHaveBeenCalledWith(selectedRoot, true)
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('prompts to update when skill contents changed without skill name changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-content-change-'))
    const installRoot = join(root, 'agent-skills')

    await mkdir(installRoot, {recursive: true})
    await writeFile(
      join(installRoot, '.centralize-config.json'),
      JSON.stringify({
        mode: 'multi-skill-bundle-with-symlinks',
        sourceRepo: '/repo/vercel-labs/agent-skills',
        bundleName: 'agent-skills',
        prefix: 'vercel-',
        installedSkills: ['vercel-a']
      })
    )

    const promptSelect = vi.fn()
      .mockResolvedValueOnce('update')
      .mockResolvedValueOnce(installRoot)
    const promptConfirm = vi.fn().mockResolvedValueOnce(true)
    const runRefresh = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({
        mode: 'multi-skill-bundle-with-symlinks',
        dryRun: true,
        bundleName: 'agent-skills',
        prefix: 'vercel-',
        discoveredSkills: ['a'],
        installedSkills: ['vercel-a'],
        contentChangedSkills: ['vercel-a'],
        publishedTo: installRoot
      }))
      .mockResolvedValueOnce('')

    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptSelect,
      promptConfirm,
      promptInput: vi.fn(),
      buildModeChoices: vi.fn(),
      buildRepoSelectionChoices: vi.fn()
    }))
    vi.doMock('../src/lib/centralize/scripts.js', () => ({
      listCentralizedInstalls: vi.fn().mockResolvedValue([{
        kind: 'bundle',
        mode: 'multi-skill-bundle-with-symlinks',
        name: 'agent-skills',
        prefix: 'vercel-',
        sourceRepo: '/repo/vercel-labs/agent-skills',
        installedRoot: installRoot
      }]),
      inspectUpstreamStatus: vi.fn().mockResolvedValue({state: 'check_failed', message: 'fetch failed'}),
      parsePublishPreview: (output: string) => JSON.parse(output),
      pullLatest: vi.fn(),
      runPublish: vi.fn(),
      runRefresh
    }))
    vi.doMock('../src/lib/centralize/inspect.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/inspect.js')>('../src/lib/centralize/inspect.js')
      return {
        ...actual,
        inspectRepo: vi.fn().mockResolvedValue({isGitRepo: false, hasWorkingTreeChanges: false})
      }
    })
    vi.doMock('../src/lib/centralize/verify.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/verify.js')>('../src/lib/centralize/verify.js')
      return {
        ...actual,
        verifyInstallContentMatchesSource: vi.fn().mockResolvedValue({ok: false, checkedPaths: [installRoot], failures: [`${installRoot}/vercel-a`]})
      }
    })

    try {
      const commandModule = await import('../src/commands/centralize/skills.js')
      const command = new commandModule.default([], {} as never)
      const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

      await command.run()

      expect(promptConfirm).toHaveBeenCalledWith('Proceed with update?')
      expect(runRefresh).toHaveBeenNthCalledWith(1, installRoot, true)
      expect(runRefresh).toHaveBeenNthCalledWith(2, installRoot, false)
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Updated skills'))
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Sync complete'))
      expect(log).toHaveBeenCalledWith(expect.stringContaining('does not match local source repo'))
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('reports successful post-update verification for prefixed bundle members', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-verify-success-'))
    const installRoot = join(root, 'ui-ux-pro-max-skill')

    await mkdir(installRoot, {recursive: true})
    await writeFile(
      join(installRoot, '.centralize-config.json'),
      JSON.stringify({
        mode: 'multi-skill-bundle-with-symlinks',
        sourceRepo: '/repo/ui-ux-pro-max-skill',
        bundleName: 'ui-ux-pro-max-skill',
        prefix: 'uipro-',
        discoveredSkills: ['ui-ux-pro-max'],
        installedSkills: ['uipro-ui-ux-pro-max']
      })
    )

    const promptSelect = vi.fn()
      .mockResolvedValueOnce('update')
      .mockResolvedValueOnce(installRoot)
    const promptConfirm = vi.fn().mockResolvedValueOnce(true)
    const runRefresh = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({
        mode: 'multi-skill-bundle-with-symlinks',
        dryRun: true,
        bundleName: 'ui-ux-pro-max-skill',
        prefix: 'uipro-',
        discoveredSkills: ['ui-ux-pro-max'],
        installedSkills: ['uipro-ui-ux-pro-max'],
        contentChangedSkills: ['uipro-ui-ux-pro-max'],
        publishedTo: installRoot
      }))
      .mockResolvedValueOnce('')

    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptSelect,
      promptConfirm,
      promptInput: vi.fn(),
      buildModeChoices: vi.fn(),
      buildRepoSelectionChoices: vi.fn()
    }))
    vi.doMock('../src/lib/centralize/scripts.js', () => ({
      listCentralizedInstalls: vi.fn().mockResolvedValue([{
        kind: 'bundle',
        mode: 'multi-skill-bundle-with-symlinks',
        name: 'ui-ux-pro-max-skill',
        prefix: 'uipro-',
        sourceRepo: '/repo/ui-ux-pro-max-skill',
        installedRoot: installRoot
      }]),
      inspectUpstreamStatus: vi.fn().mockResolvedValue({state: 'up_to_date', behindCount: 0, upstreamRef: 'origin/main'}),
      parsePublishPreview: (output: string) => JSON.parse(output),
      pullLatest: vi.fn(),
      runPublish: vi.fn(),
      runRefresh
    }))
    vi.doMock('../src/lib/centralize/inspect.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/inspect.js')>('../src/lib/centralize/inspect.js')
      return {
        ...actual,
        inspectRepo: vi.fn().mockResolvedValue({isGitRepo: true, hasWorkingTreeChanges: false})
      }
    })
    vi.doMock('../src/lib/centralize/verify.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/verify.js')>('../src/lib/centralize/verify.js')
      return {
        ...actual,
        verifyInstallContentMatchesSource: vi.fn().mockResolvedValue({ok: true, checkedPaths: [`${installRoot}/uipro-ui-ux-pro-max`], failures: []})
      }
    })

    try {
      const commandModule = await import('../src/commands/centralize/skills.js')
      const command = new commandModule.default([], {} as never)
      const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

      await command.run()

      expect(promptConfirm).toHaveBeenCalledWith('Proceed with update?')
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Centralized copy matches local source repo'))
      expect(log).not.toHaveBeenCalledWith(expect.stringContaining('does not match local source repo'))
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('heals stale stored sourceRepo paths before update inspection and preview', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-stale-update-'))
    const sourceRepo = join(root, 'repo')
    const healedSourceRepo = join(sourceRepo, 'skill')
    const installRoot = join(root, 'impeccable')

    await mkdir(healedSourceRepo, {recursive: true})
    await writeFile(join(healedSourceRepo, 'SKILL.md'), '---\nname: impeccable\n---\n')
    await mkdir(join(sourceRepo, '.claude', 'skills', 'impeccable'), {recursive: true})
    await writeFile(join(sourceRepo, '.claude', 'skills', 'impeccable', 'SKILL.md'), '---\nname: impeccable\n---\n')
    await mkdir(installRoot, {recursive: true})
    await writeFile(
      join(installRoot, '.centralize-config.json'),
      JSON.stringify({
        mode: 'multi-skill-bundle-with-symlinks',
        sourceRepo: join(sourceRepo, 'source'),
        bundleName: 'impeccable',
        prefix: 'i-',
        discoveredSkills: ['impeccable'],
        installedSkills: ['i-impeccable']
      })
    )

    const promptSelect = vi.fn()
      .mockResolvedValueOnce('update')
      .mockResolvedValueOnce(installRoot)
    const runRefresh = vi.fn().mockResolvedValueOnce(JSON.stringify({
      mode: 'multi-skill-bundle-with-symlinks',
      dryRun: true,
      bundleName: 'impeccable',
      prefix: 'i-',
      discoveredSkills: ['impeccable'],
      installedSkills: ['i-impeccable'],
      contentChangedSkills: [],
      publishedTo: installRoot
    }))

    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptSelect,
      promptConfirm: vi.fn(),
      promptInput: vi.fn(),
      buildModeChoices: vi.fn(),
      buildRepoSelectionChoices: vi.fn()
    }))
    vi.doMock('../src/lib/centralize/scripts.js', () => ({
      listCentralizedInstalls: vi.fn().mockResolvedValue([{
        kind: 'bundle',
        mode: 'multi-skill-bundle-with-symlinks',
        name: 'impeccable',
        prefix: 'i-',
        sourceRepo: join(sourceRepo, 'source'),
        installedRoot: installRoot
      }]),
      inspectUpstreamStatus: vi.fn().mockResolvedValue({state: 'no_upstream'}),
      parsePublishPreview: (output: string) => JSON.parse(output),
      pullLatest: vi.fn(),
      runPublish: vi.fn(),
      runRefresh
    }))
    vi.doMock('../src/lib/centralize/inspect.js', async () => await vi.importActual<typeof import('../src/lib/centralize/inspect.js')>('../src/lib/centralize/inspect.js'))
    try {
      const commandModule = await import('../src/commands/centralize/skills.js')
      const command = new commandModule.default([], {} as never)
      const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

      await command.run()

      expect(runRefresh).toHaveBeenCalledWith(installRoot, true)
      expect(log).toHaveBeenCalledWith(expect.stringContaining(healedSourceRepo))
      expect(log).not.toHaveBeenCalledWith(expect.stringContaining(join(sourceRepo, 'source')))
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('blocks update when the source repo has local changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-dirty-source-'))
    const installRoot = join(root, 'agent-skills')

    await mkdir(installRoot, {recursive: true})
    await writeFile(
      join(installRoot, '.centralize-config.json'),
      JSON.stringify({
        mode: 'multi-skill-bundle-with-symlinks',
        sourceRepo: '/repo/vercel-labs/agent-skills',
        bundleName: 'agent-skills',
        prefix: 'vercel-',
        installedSkills: ['vercel-a']
      })
    )

    const promptSelect = vi.fn()
      .mockResolvedValueOnce('update')
      .mockResolvedValueOnce(installRoot)

    const runRefresh = vi.fn()

    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptSelect,
      promptConfirm: vi.fn(),
      promptInput: vi.fn(),
      buildModeChoices: vi.fn(),
      buildRepoSelectionChoices: vi.fn()
    }))
    vi.doMock('../src/lib/centralize/scripts.js', () => ({
      listCentralizedInstalls: vi.fn().mockResolvedValue([{
        kind: 'bundle',
        mode: 'multi-skill-bundle-with-symlinks',
        name: 'agent-skills',
        prefix: 'vercel-',
        sourceRepo: '/repo/vercel-labs/agent-skills',
        installedRoot: installRoot
      }]),
      inspectUpstreamStatus: vi.fn(),
      parsePublishPreview: (output: string) => JSON.parse(output),
      pullLatest: vi.fn(),
      runPublish: vi.fn(),
      runRefresh
    }))
    vi.doMock('../src/lib/centralize/inspect.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/inspect.js')>('../src/lib/centralize/inspect.js')
      return {
        ...actual,
        inspectRepo: vi.fn().mockResolvedValue({isGitRepo: true, hasWorkingTreeChanges: true})
      }
    })

    try {
      const commandModule = await import('../src/commands/centralize/skills.js')
      const command = new commandModule.default([], {} as never)
      const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

      await command.run()

      expect(runRefresh).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Source repo has local changes'))
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('requires toolai init before using configured repos', async () => {
    const promptSelect = vi.fn()
      .mockResolvedValueOnce('add')
      .mockResolvedValueOnce('configured')

    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptSelect,
      promptConfirm: vi.fn(),
      promptInput: vi.fn(),
      buildModeChoices: vi.fn(),
      buildRepoSelectionChoices: vi.fn().mockReturnValue([])
    }))
    vi.doMock('../src/lib/config/toolai-config.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/config/toolai-config.js')>('../src/lib/config/toolai-config.js')
      return {
        ...actual,
        ToolaiConfigError: class ToolaiConfigError extends Error {},
        getConfiguredSkillsRoot: vi.fn().mockResolvedValue('/central/skills')
      }
    })
    vi.doMock('../src/lib/centralize/inspect.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/inspect.js')>('../src/lib/centralize/inspect.js')
      const {ToolaiConfigError} = await import('../src/lib/config/toolai-config.js')
      return {
        ...actual,
        discoverConfiguredRepos: vi.fn().mockRejectedValue(new ToolaiConfigError('toolai is not initialized. Run toolai init first.'))
      }
    })

    const commandModule = await import('../src/commands/centralize/skills.js')
    const command = new commandModule.default([], {} as never)
    const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

    await command.run()

    expect(log).toHaveBeenCalledWith(expect.stringContaining('toolai is not initialized. Run toolai init first.'))
  })
})
