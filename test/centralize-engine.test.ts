import {mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach, describe, expect, it} from 'vitest'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.map(root => rm(root, {recursive: true, force: true})))
  tempRoots.length = 0
})

async function createSkill(root: string, relativeDir: string, frontmatterName: string) {
  const skillDir = join(root, relativeDir)
  await mkdir(skillDir, {recursive: true})
  await writeFile(join(skillDir, 'SKILL.md'), `---\nname: ${frontmatterName}\n---\n`)
}

describe('centralize engine', () => {
  it('publishes canonical Skill identities from SKILL frontmatter instead of generic directory basenames', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-canonical-publish-'))
    tempRoots.push(root)
    const sourceRepo = join(root, 'repo')
    const centralRoot = join(root, 'central')

    await createSkill(sourceRepo, 'skill', 'impeccable')
    await mkdir(centralRoot, {recursive: true})

    const {publishSkills} = await import('../src/lib/centralize/engine.js')
    const preview = await publishSkills(sourceRepo, undefined, 'i', false, {centralRoot})

    expect(preview.mode).toBe('single-skill-direct-install')
    expect(preview.discoveredSkills).toEqual(['impeccable'])
    expect(preview.installedSkills).toEqual(['i-impeccable'])

    const config = JSON.parse(await readFile(join(centralRoot, 'i-impeccable', '.centralize-config.json'), 'utf8'))
    expect(config.discoveredSkills).toEqual(['impeccable'])
    expect(config.installedSkills).toEqual(['i-impeccable'])
  })

  it('publishes bundle installs and lists them without shell scripts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-engine-'))
    tempRoots.push(root)
    const sourceRepo = join(root, 'repo')
    const centralRoot = join(root, 'central')

    await createSkill(sourceRepo, 'skills/alpha', 'alpha')
    await createSkill(sourceRepo, 'skills/beta', 'beta')
    await mkdir(centralRoot, {recursive: true})

    const {listCentralizedInstalls, publishSkills} = await import('../src/lib/centralize/engine.js')
    const preview = await publishSkills(sourceRepo, 'bundle-pack', 'pref', false, {centralRoot})
    const installs = await listCentralizedInstalls({centralRoot})

    expect(preview.mode).toBe('multi-skill-bundle-with-symlinks')
    expect(preview.installedSkills).toEqual(['pref-alpha', 'pref-beta'])
    expect(installs).toEqual([
      expect.objectContaining({
        kind: 'bundle',
        name: 'bundle-pack',
        sourceRepo
      })
    ])

    const config = JSON.parse(await readFile(join(centralRoot, 'bundle-pack', '.centralize-config.json'), 'utf8'))
    expect(config.installedSkills).toEqual(['pref-alpha', 'pref-beta'])
  })

  it('refreshes bundles by pruning removed members owned by the install only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-prune-'))
    tempRoots.push(root)
    const sourceRepo = join(root, 'repo')
    const centralRoot = join(root, 'central')

    await createSkill(sourceRepo, 'skills/alpha', 'alpha')
    await createSkill(sourceRepo, 'skills/beta', 'beta')
    await mkdir(centralRoot, {recursive: true})

    const {publishSkills, refreshSkills} = await import('../src/lib/centralize/engine.js')
    await publishSkills(sourceRepo, 'bundle-pack', 'pref', false, {centralRoot})

    await rm(join(sourceRepo, 'skills', 'beta'), {recursive: true, force: true})
    await mkdir(join(centralRoot, 'unrelated'), {recursive: true})
    await createSkill(centralRoot, 'unrelated/pref-beta', 'pref-beta')
    await symlink('unrelated/pref-beta', join(centralRoot, 'pref-beta-unrelated'))

    const preview = await refreshSkills(join(centralRoot, 'bundle-pack'), false, {centralRoot})
    const bundleEntries = await readdir(join(centralRoot, 'bundle-pack'))
    const topLevelEntries = await readdir(centralRoot)

expect(preview.installedSkills).toEqual(['pref-alpha'])
    expect(bundleEntries).toContain('pref-alpha')
    expect(bundleEntries).not.toContain('pref-beta')
    expect(topLevelEntries).not.toContain('pref-beta')
    expect(topLevelEntries).toContain('pref-beta-unrelated')
  })

  it('rebuilds bundle installs fresh so stale files are removed on refresh', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-rebuild-'))
    tempRoots.push(root)
    const sourceRepo = join(root, 'repo')
    const centralRoot = join(root, 'central')

    await createSkill(sourceRepo, 'skills/alpha', 'alpha')
    await createSkill(sourceRepo, 'skills/beta', 'beta')
    await mkdir(centralRoot, {recursive: true})

    const {publishSkills, refreshSkills} = await import('../src/lib/centralize/engine.js')
    await publishSkills(sourceRepo, 'bundle-pack', 'pref', false, {centralRoot})

    await writeFile(join(centralRoot, 'bundle-pack', 'pref-alpha', 'stale.txt'), 'remove me')
    await refreshSkills(join(centralRoot, 'bundle-pack'), false, {centralRoot})

    await expect(readFile(join(centralRoot, 'bundle-pack', 'pref-alpha', 'stale.txt'), 'utf8')).rejects.toThrow()
  })

  it('refreshes successfully when stored sourceRepo points to a removed nested path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-stale-source-'))
    tempRoots.push(root)
    const sourceRepo = join(root, 'repo')
    const centralRoot = join(root, 'central')

    await createSkill(sourceRepo, 'skills/alpha', 'alpha')
    await createSkill(sourceRepo, 'skills/beta', 'beta')
    await mkdir(centralRoot, {recursive: true})

    const {publishSkills, refreshSkills} = await import('../src/lib/centralize/engine.js')
    await publishSkills(sourceRepo, 'bundle-pack', 'pref', false, {centralRoot})

    const configPath = join(centralRoot, 'bundle-pack', '.centralize-config.json')
    const config = JSON.parse(await readFile(configPath, 'utf8'))
    config.sourceRepo = join(sourceRepo, 'source')
    await writeFile(configPath, JSON.stringify(config, null, 2))

    const preview = await refreshSkills(join(centralRoot, 'bundle-pack'), false, {centralRoot})
    const refreshedConfig = JSON.parse(await readFile(configPath, 'utf8'))

    expect(preview.publishedTo).toBe(join(centralRoot, 'bundle-pack'))
    expect(refreshedConfig.sourceRepo).toBe(sourceRepo)
    expect(refreshedConfig.installedSkills).toEqual(['pref-alpha', 'pref-beta'])
  })

  it('rejects stale source healing that would overshoot to a broad ancestor with unrelated Skills', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-stale-overshoot-'))
    tempRoots.push(root)
    const sourceRepo = join(root, 'repo')
    const centralRoot = join(root, 'central')

    await createSkill(sourceRepo, 'skills/alpha', 'alpha')
    await createSkill(sourceRepo, 'skills/beta', 'beta')
    await mkdir(centralRoot, {recursive: true})
    await createSkill(root, 'skills/alpha', 'alpha')
    await createSkill(root, 'skills/beta', 'beta')
    await createSkill(root, 'skills/unrelated', 'unrelated')

    const {publishSkills, refreshSkills} = await import('../src/lib/centralize/engine.js')
    await publishSkills(sourceRepo, 'bundle-pack', 'pref', false, {centralRoot})

    const configPath = join(centralRoot, 'bundle-pack', '.centralize-config.json')
    const config = JSON.parse(await readFile(configPath, 'utf8'))
    config.sourceRepo = join(sourceRepo, 'source')
    await writeFile(configPath, JSON.stringify(config, null, 2))
    await rm(sourceRepo, {recursive: true, force: true})

    await expect(refreshSkills(join(centralRoot, 'bundle-pack'), false, {centralRoot})).rejects.toThrow(
      'could not resolve centralized source repo from stored install identity'
    )
  })

  it('refreshes successfully when stale sourceRepo heals to a nested canonical Skill dir in a mixed repo', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-stale-nested-heal-'))
    tempRoots.push(root)
    const sourceRepo = join(root, 'repo')
    const centralRoot = join(root, 'central')
    const installRoot = join(centralRoot, 'impeccable')

    await createSkill(sourceRepo, 'skill', 'impeccable')
    await createSkill(sourceRepo, '.claude/skills/impeccable', 'impeccable')
    await mkdir(installRoot, {recursive: true})
    await writeFile(
      join(installRoot, '.centralize-config.json'),
      JSON.stringify({
        version: 1,
        mode: 'multi-skill-bundle-with-symlinks',
        sourceRepo: join(sourceRepo, 'source'),
        bundleName: 'impeccable',
        prefix: 'i-',
        discoveredSkills: ['impeccable'],
        installedSkills: ['i-impeccable']
      }, null, 2)
    )

    const {refreshSkills} = await import('../src/lib/centralize/engine.js')
    const preview = await refreshSkills(installRoot, false, {centralRoot})
    const refreshedConfig = JSON.parse(await readFile(join(installRoot, '.centralize-config.json'), 'utf8'))

    expect(preview.publishedTo).toBe(installRoot)
    expect(preview.discoveredSkills).toEqual(['impeccable'])
    expect(refreshedConfig.sourceRepo).toBe(join(sourceRepo, 'skill'))
    expect(refreshedConfig.installedSkills).toEqual(['i-impeccable'])
  })

  it('continues past mirrored repo-root discovery mismatches and heals to a matching nested skill dir', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-stale-mirrored-heal-'))
    tempRoots.push(root)
    const sourceRepo = join(root, 'repo')
    const centralRoot = join(root, 'central')
    const installRoot = join(centralRoot, 'impeccable')

    await createSkill(sourceRepo, '.agents/skills/impeccable', 'impeccable')
    await createSkill(sourceRepo, '.claude/skills/impeccable', 'impeccable')
    await createSkill(sourceRepo, 'plugin/skills/impeccable', 'impeccable')
    await mkdir(installRoot, {recursive: true})
    await writeFile(
      join(installRoot, '.centralize-config.json'),
      JSON.stringify({
        version: 1,
        mode: 'multi-skill-bundle-with-symlinks',
        sourceRepo: join(sourceRepo, 'source'),
        bundleName: 'impeccable',
        prefix: 'i-',
        discoveredSkills: ['impeccable'],
        installedSkills: ['i-impeccable']
      }, null, 2)
    )

    const {refreshSkills} = await import('../src/lib/centralize/engine.js')
    const preview = await refreshSkills(installRoot, false, {centralRoot})
    const refreshedConfig = JSON.parse(await readFile(join(installRoot, '.centralize-config.json'), 'utf8'))

    expect(preview.publishedTo).toBe(installRoot)
    expect(preview.discoveredSkills).toEqual(['impeccable'])
    expect(refreshedConfig.sourceRepo).toBe(join(sourceRepo, '.agents/skills/impeccable'))
    expect(refreshedConfig.installedSkills).toEqual(['i-impeccable'])
  })
})
