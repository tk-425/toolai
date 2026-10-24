import {mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach, describe, expect, it, vi} from 'vitest'

const tempRoots: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  vi.doUnmock('../src/lib/security/index.js')
  vi.resetModules()
  await Promise.all(tempRoots.map(root => rm(root, {recursive: true, force: true})))
  tempRoots.length = 0
})

async function seedStandaloneStore(centralRoot: string, name: string): Promise<string> {
  const skillDir = join(centralRoot, name)
  await mkdir(skillDir, {recursive: true})
  await writeFile(join(skillDir, 'SKILL.md'), `---\nname: ${name}\n---\n`)
  await writeFile(
    join(skillDir, '.centralize-config.json'),
    JSON.stringify({
      mode: 'single-skill-direct-install',
      sourceRepo: '/repo/example',
      bundleName: name,
      prefix: '',
      installedSkills: [name]
    })
  )
  return skillDir
}

async function seedBundleStore(
  centralRoot: string,
  bundleName: string,
  installedSkills: string[],
  discoveredSkills: string[] = installedSkills
): Promise<string> {
  const bundleDir = join(centralRoot, bundleName)
  await mkdir(bundleDir, {recursive: true})
  for (const skillName of installedSkills) {
    const skillDir = join(bundleDir, skillName)
    await mkdir(skillDir, {recursive: true})
    await writeFile(join(skillDir, 'SKILL.md'), `---\nname: ${skillName}\n---\n`)
    await symlink(`${bundleName}/${skillName}`, join(centralRoot, skillName))
  }
  await writeFile(
    join(bundleDir, '.centralize-config.json'),
    JSON.stringify({
      mode: 'multi-skill-bundle-with-symlinks',
      sourceRepo: '/repo/example',
      bundleName,
      prefix: 'pref-',
      discoveredSkills,
      installedSkills
    })
  )
  return bundleDir
}

function manifestData(names: string[]): string {
  return JSON.stringify({
    last_updated: '',
    skills: Object.fromEntries(names.map(name => [
      name,
      {name, hash: 'h', status: 'pending', updatedAt: '', scannedAt: null}
    ]))
  })
}

describe('centralize remove engine', () => {
  it('enumerates, plans, and removes a standalone Skill end to end', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-remove-'))
    tempRoots.push(root)
    const centralRoot = join(root, 'central')
    const manifestPath = join(root, 'manifest.json')

    await mkdir(centralRoot, {recursive: true})
    const skillDir = await seedStandaloneStore(centralRoot, 'my-skill')
    await writeFile(
      manifestPath,
      JSON.stringify({
        last_updated: '',
        skills: {
          'my-skill': {name: 'my-skill', hash: 'h', status: 'pending', updatedAt: '', scannedAt: null}
        }
      })
    )

    vi.doMock('../src/lib/security/index.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/security/index.js')>('../src/lib/security/index.js')
      return {...actual, getSkillManifestPath: () => manifestPath}
    })

    const {buildRemovalPlan, enumerateRemovalTargets, executeRemoval} = await import('../src/lib/centralize/engine.js')

    const targets = await enumerateRemovalTargets({centralRoot})
    expect(targets).toEqual([{kind: 'standalone', name: 'my-skill'}])

    const plan = await buildRemovalPlan(targets[0], {centralRoot})
    expect(plan.paths).toEqual([skillDir])
    expect(plan.manifestEntries).toEqual(['my-skill'])

    const summary = await executeRemoval(plan, {centralRoot})
    expect(summary.removedPaths).toEqual([skillDir])
    expect(summary.removedManifestEntries).toEqual(['my-skill'])
    expect(summary.skippedPaths).toEqual([])

    await expect(readFile(join(skillDir, 'SKILL.md'), 'utf8')).rejects.toThrow()
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    expect(manifest.skills).toEqual({})
  })

  it('enumerates bundle, standalone, and skill-in-bundle removal targets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-enumerate-'))
    tempRoots.push(root)
    const centralRoot = join(root, 'central')
    await mkdir(centralRoot, {recursive: true})

    await seedStandaloneStore(centralRoot, 'my-skill')
    await seedBundleStore(centralRoot, 'bundle-pack', ['pref-alpha', 'pref-beta'], ['alpha', 'beta'])

    const {enumerateRemovalTargets} = await import('../src/lib/centralize/engine.js')
    const targets = await enumerateRemovalTargets({centralRoot})

    expect(targets).toEqual([
      {kind: 'bundle', name: 'bundle-pack'},
      {kind: 'skill-in-bundle', name: 'pref-alpha', bundleName: 'bundle-pack'},
      {kind: 'skill-in-bundle', name: 'pref-beta', bundleName: 'bundle-pack'},
      {kind: 'standalone', name: 'my-skill'}
    ])
  })

  it('builds a bundle removal plan with owned flat symlinks and manifest entries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-bundle-plan-'))
    tempRoots.push(root)
    const centralRoot = join(root, 'central')
    await mkdir(centralRoot, {recursive: true})

    const bundleDir = await seedBundleStore(centralRoot, 'bundle-pack', ['pref-alpha', 'pref-beta'], ['alpha', 'beta'])

    // repoint the pref-beta alias outside the bundle so it is not owned
    await rm(join(centralRoot, 'pref-beta'))
    await mkdir(join(centralRoot, 'elsewhere'), {recursive: true})
    await symlink('elsewhere/pref-beta', join(centralRoot, 'pref-beta'))

    const {buildRemovalPlan} = await import('../src/lib/centralize/engine.js')
    const plan = await buildRemovalPlan({kind: 'bundle', name: 'bundle-pack'}, {centralRoot})

    expect(plan.paths).toEqual([bundleDir, join(centralRoot, 'pref-alpha')])
    expect(plan.manifestEntries).toEqual(['pref-alpha', 'pref-beta'])
  })

  it('builds a skill-in-bundle plan with config rewrite and the last-skill flag', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-skill-plan-'))
    tempRoots.push(root)
    const centralRoot = join(root, 'central')
    await mkdir(centralRoot, {recursive: true})

    const bundleDir = await seedBundleStore(centralRoot, 'bundle-pack', ['pref-alpha', 'pref-beta'], ['alpha', 'beta'])

    const {buildRemovalPlan} = await import('../src/lib/centralize/engine.js')

    const plan = await buildRemovalPlan(
      {kind: 'skill-in-bundle', name: 'pref-alpha', bundleName: 'bundle-pack'},
      {centralRoot}
    )
    expect(plan.paths).toEqual([join(bundleDir, 'pref-alpha'), join(centralRoot, 'pref-alpha')])
    expect(plan.manifestEntries).toEqual(['pref-alpha'])
    expect(plan.configRewrite).toEqual({
      configPath: join(bundleDir, '.centralize-config.json'),
      installedSkills: ['pref-beta'],
      discoveredSkills: ['beta']
    })
    expect(plan.removesBundle).toBe(false)

    const singleBundleDir = await seedBundleStore(centralRoot, 'single-pack', ['pref-only'], ['only'])
    const lastPlan = await buildRemovalPlan(
      {kind: 'skill-in-bundle', name: 'pref-only', bundleName: 'single-pack'},
      {centralRoot}
    )
    expect(lastPlan.configRewrite).toEqual({
      configPath: join(singleBundleDir, '.centralize-config.json'),
      installedSkills: [],
      discoveredSkills: []
    })
    expect(lastPlan.removesBundle).toBe(true)
  })

  it('executes a whole-bundle removal deleting directory, aliases, and manifest entries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-bundle-exec-'))
    tempRoots.push(root)
    const centralRoot = join(root, 'central')
    const manifestPath = join(root, 'manifest.json')
    await mkdir(centralRoot, {recursive: true})

    const bundleDir = await seedBundleStore(centralRoot, 'bundle-pack', ['pref-alpha', 'pref-beta'], ['alpha', 'beta'])
    await writeFile(manifestPath, manifestData(['pref-alpha', 'pref-beta']))

    vi.doMock('../src/lib/security/index.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/security/index.js')>('../src/lib/security/index.js')
      return {...actual, getSkillManifestPath: () => manifestPath}
    })

    const {buildRemovalPlan, executeRemoval} = await import('../src/lib/centralize/engine.js')
    const plan = await buildRemovalPlan({kind: 'bundle', name: 'bundle-pack'}, {centralRoot})
    const summary = await executeRemoval(plan, {centralRoot})

    expect(summary.removedPaths).toEqual([bundleDir, join(centralRoot, 'pref-alpha'), join(centralRoot, 'pref-beta')])
    expect(summary.removedManifestEntries).toEqual(['pref-alpha', 'pref-beta'])

    await expect(readFile(join(bundleDir, '.centralize-config.json'), 'utf8')).rejects.toThrow()
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    expect(manifest.skills).toEqual({})
  })

  it('executes a skill-in-bundle removal with config rewrite, keeping the bundle', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-skill-exec-'))
    tempRoots.push(root)
    const centralRoot = join(root, 'central')
    const manifestPath = join(root, 'manifest.json')
    await mkdir(centralRoot, {recursive: true})

    const bundleDir = await seedBundleStore(centralRoot, 'bundle-pack', ['pref-alpha', 'pref-beta'], ['alpha', 'beta'])
    await writeFile(manifestPath, manifestData(['pref-alpha', 'pref-beta']))

    vi.doMock('../src/lib/security/index.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/security/index.js')>('../src/lib/security/index.js')
      return {...actual, getSkillManifestPath: () => manifestPath}
    })

    const {buildRemovalPlan, executeRemoval} = await import('../src/lib/centralize/engine.js')
    const plan = await buildRemovalPlan({kind: 'skill-in-bundle', name: 'pref-alpha', bundleName: 'bundle-pack'}, {centralRoot})
    const summary = await executeRemoval(plan, {centralRoot})

    expect(summary.removedPaths).toEqual([join(bundleDir, 'pref-alpha'), join(centralRoot, 'pref-alpha')])
    expect(summary.removedManifestEntries).toEqual(['pref-alpha'])

    await expect(readFile(join(bundleDir, 'pref-alpha', 'SKILL.md'), 'utf8')).rejects.toThrow()
    const config = JSON.parse(await readFile(join(bundleDir, '.centralize-config.json'), 'utf8'))
    expect(config.installedSkills).toEqual(['pref-beta'])
    expect(config.discoveredSkills).toEqual(['beta'])
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    expect(manifest.skills).toEqual({'pref-beta': expect.objectContaining({name: 'pref-beta'})})
  })

  it('removes the now-empty bundle when the last skill is removed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-last-skill-'))
    tempRoots.push(root)
    const centralRoot = join(root, 'central')
    const manifestPath = join(root, 'manifest.json')
    await mkdir(centralRoot, {recursive: true})

    const bundleDir = await seedBundleStore(centralRoot, 'single-pack', ['pref-only'], ['only'])
    await writeFile(manifestPath, manifestData(['pref-only']))

    vi.doMock('../src/lib/security/index.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/security/index.js')>('../src/lib/security/index.js')
      return {...actual, getSkillManifestPath: () => manifestPath}
    })

    const {buildRemovalPlan, executeRemoval} = await import('../src/lib/centralize/engine.js')
    const plan = await buildRemovalPlan({kind: 'skill-in-bundle', name: 'pref-only', bundleName: 'single-pack'}, {centralRoot})
    const summary = await executeRemoval(plan, {centralRoot})

    expect(summary.removedPaths).toEqual([
      join(bundleDir, 'pref-only'),
      join(centralRoot, 'pref-only'),
      bundleDir
    ])
    expect(summary.removedManifestEntries).toEqual(['pref-only'])

    await expect(readFile(join(bundleDir, '.centralize-config.json'), 'utf8')).rejects.toThrow()
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    expect(manifest.skills).toEqual({})
  })

  it('exits cleanly and mutates nothing when the target is already absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-absent-'))
    tempRoots.push(root)
    const centralRoot = join(root, 'central')
    const manifestPath = join(root, 'manifest.json')
    await mkdir(centralRoot, {recursive: true})

    const skillDir = await seedStandaloneStore(centralRoot, 'my-skill')
    // simulate an already-absent target: directory and manifest entry are gone
    await rm(skillDir, {recursive: true, force: true})
    await writeFile(manifestPath, JSON.stringify({last_updated: '', skills: {}}))

    vi.doMock('../src/lib/security/index.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/security/index.js')>('../src/lib/security/index.js')
      return {...actual, getSkillManifestPath: () => manifestPath}
    })

    const {buildRemovalPlan, executeRemoval} = await import('../src/lib/centralize/engine.js')
    const plan = await buildRemovalPlan({kind: 'standalone', name: 'my-skill'}, {centralRoot})
    const manifestBefore = await readFile(manifestPath, 'utf8')
    const summary = await executeRemoval(plan, {centralRoot})
    const manifestAfter = await readFile(manifestPath, 'utf8')

    expect(summary.removedPaths).toEqual([])
    expect(summary.removedManifestEntries).toEqual([])
    expect(summary.skippedPaths).toEqual([skillDir])
    expect(summary.message).toBe('Target was already removed.')
    expect(manifestAfter).toBe(manifestBefore)
  })

  it('unlinks a symlink without following its target', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-symlink-'))
    tempRoots.push(root)
    const centralRoot = join(root, 'central')
    const manifestPath = join(root, 'manifest.json')
    await mkdir(centralRoot, {recursive: true})

    const outsideTarget = join(root, 'outside')
    await mkdir(outsideTarget, {recursive: true})
    await writeFile(join(outsideTarget, 'SKILL.md'), '---\nname: my-skill\n---\n')
    await writeFile(manifestPath, manifestData(['my-skill']))

    // the store entry is a symlink pointing outside the store
    await symlink(outsideTarget, join(centralRoot, 'my-skill'))

    vi.doMock('../src/lib/security/index.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/security/index.js')>('../src/lib/security/index.js')
      return {...actual, getSkillManifestPath: () => manifestPath}
    })

    const {buildRemovalPlan, executeRemoval} = await import('../src/lib/centralize/engine.js')
    const plan = await buildRemovalPlan({kind: 'standalone', name: 'my-skill'}, {centralRoot})
    const summary = await executeRemoval(plan, {centralRoot})

    expect(summary.removedPaths).toEqual([join(centralRoot, 'my-skill')])
    // the symlink is gone, but the target it pointed to survives untouched
    await expect(readFile(join(centralRoot, 'my-skill', 'SKILL.md'), 'utf8')).rejects.toThrow()
    await expect(readFile(join(outsideTarget, 'SKILL.md'), 'utf8')).resolves.toContain('name: my-skill')
  })
})
