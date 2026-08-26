import {describe, expect, it} from 'vitest'

describe('centralize scripts', () => {
  it('parses preview JSON when braces appear inside string literals', async () => {
    const {parsePublishPreview} = await import('../src/lib/centralize/scripts.js')
    const preview = parsePublishPreview([
      'noise before preview',
      '{"mode":"single-skill-direct-install","dryRun":true,"bundleName":"bundle","prefix":"","discoveredSkills":["alpha"],"installedSkills":["alpha"],"publishedTo":"/central/skill-{1}"}',
      'noise after preview'
    ].join('\n'))

    expect(preview).toEqual(expect.objectContaining({
      mode: 'single-skill-direct-install',
      publishedTo: '/central/skill-{1}'
    }))
  })

  it('returns native publish previews without shell wrapper output', async () => {
    const {runPublish} = await import('../src/lib/centralize/scripts.js')
    const {mkdtemp, mkdir, writeFile, rm} = await import('node:fs/promises')
    const {join} = await import('node:path')
    const {tmpdir} = await import('node:os')
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-native-'))

    try {
      const repo = join(root, 'repo')
      await mkdir(join(repo, 'skills', 'alpha'), {recursive: true})
      await writeFile(join(repo, 'skills', 'alpha', 'SKILL.md'), '---\nname: alpha\n---\n')

      const output = await runPublish(repo, undefined, undefined, true)

      expect(output).toContain('"mode": "single-skill-direct-install"')
      expect(output).not.toContain('Running: bash')
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('builds the dry-run refresh command', async () => {
    const {buildRefreshArgs} = await import('../src/lib/centralize/scripts.js')

    expect(buildRefreshArgs('/central/agent-skills', true)).toEqual(['--dry-run', '/central/agent-skills'])
  })

  it('parses installed items from the list script output', async () => {
    const {parseInstalledItems} = await import('../src/lib/centralize/scripts.js')
    const text = [
      'bundle\tagent-skills\tvercel\t/repo/vercel-labs/agent-skills\t/central/agent-skills\tagent-skills',
      'standalone\tbootstrap-web\t\t/repo/bootstrap-web\t/central/bootstrap-web\tbootstrap-web'
    ].join('\n')

    expect(parseInstalledItems(text)).toEqual([
      expect.objectContaining({kind: 'bundle', name: 'agent-skills'}),
      expect.objectContaining({kind: 'standalone', name: 'bootstrap-web'})
    ])
  })

  it('supports legacy unknown entries by deferring to the installed config', async () => {
    const {mkdtemp, mkdir, writeFile, rm} = await import('node:fs/promises')
    const {join} = await import('node:path')
    const {tmpdir} = await import('node:os')
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-list-'))

    try {
      const installRoot = join(root, 'expo')
      await mkdir(installRoot, {recursive: true})
      await writeFile(
        join(installRoot, '.centralize-config.json'),
        JSON.stringify({
          sourceRepo: '/repo/expo',
          bundleName: 'expo',
          prefix: 'expo',
          installType: 'multi-skill-bundle-with-symlinks'
        })
      )

      const {readCentralizedConfig} = await import('../src/lib/centralize/inspect.js')
      const hydrated = await readCentralizedConfig(installRoot)

      expect(hydrated.kind).toBe('bundle')
      expect(hydrated.mode).toBe('multi-skill-bundle-with-symlinks')
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })
})
