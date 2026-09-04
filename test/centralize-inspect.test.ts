import {basename, join} from 'node:path'
import {afterEach, describe, expect, it} from 'vitest'
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.map(root => rm(root, {recursive: true, force: true})))
  tempRoots.length = 0
})

describe('centralize inspection', () => {
  it('uses the SKILL frontmatter name instead of a generic directory basename', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-'))
    tempRoots.push(root)

    await mkdir(join(root, 'skill'), {recursive: true})
    await writeFile(join(root, 'skill', 'SKILL.md'), ['---', 'name: impeccable', '---', 'body'].join('\n'))

    const {inspectRepo} = await import('../src/lib/centralize/inspect.js')
    const result = await inspectRepo(root)

    expect(result.layout).toBe('nested-only')
    expect(result.nestedSkills.map(skill => skill.name)).toEqual(['impeccable'])
  })

  it('falls back to directory basename when SKILL frontmatter name is absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-'))
    tempRoots.push(root)

    await mkdir(join(root, 'skill'), {recursive: true})
    await writeFile(join(root, 'skill', 'SKILL.md'), ['---', 'description: no name here', '---', 'body'].join('\n'))

    const {inspectRepo} = await import('../src/lib/centralize/inspect.js')
    const result = await inspectRepo(root)

    expect(result.layout).toBe('nested-only')
    expect(result.nestedSkills.map(skill => skill.name)).toEqual(['skill'])
  })

  it('classifies mixed layouts correctly', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-'))
    tempRoots.push(root)

    await writeFile(join(root, 'SKILL.md'), '# root')
    await mkdir(join(root, 'nested-skill'), {recursive: true})
    await writeFile(join(root, 'nested-skill', 'SKILL.md'), '# nested')

    const {inspectRepo} = await import('../src/lib/centralize/inspect.js')
    const result = await inspectRepo(root)

    expect(result.layout).toBe('mixed-layout')
    expect(result.rootSkill?.name).toBe(basename(root))
    expect(result.nestedSkills.map(skill => skill.name)).toEqual(['nested-skill'])
  })

  it('filters vendor directories out of skill discovery', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-'))
    tempRoots.push(root)

    await mkdir(join(root, 'node_modules', 'fake-skill'), {recursive: true})
    await writeFile(join(root, 'node_modules', 'fake-skill', 'SKILL.md'), '# ignore me')

    const {inspectRepo} = await import('../src/lib/centralize/inspect.js')
    const result = await inspectRepo(root)

    expect(result.nestedSkills).toEqual([])
  })

  it('discovers repositories across multiple roots with deduplication and ordering', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-config-'))
    tempRoots.push(root)
    const first = join(root, 'first')
    const second = join(root, 'second')
    await mkdir(join(first, 'z-repo', '.git'), {recursive: true})
    await mkdir(join(first, 'a-repo', '.git'), {recursive: true})
    await mkdir(join(second, 'm-repo', '.git'), {recursive: true})
    const configPath = join(root, '.toolai', 'config.yaml')
    await mkdir(join(root, '.toolai'), {recursive: true})
    await writeFile(configPath, `centralize:\n  skills-dirs:\n    - ${first}\n    - ${second}\n    - ${first}\n`, 'utf8')
    const {discoverConfiguredRepos} = await import('../src/lib/centralize/inspect.js')
    expect(await discoverConfiguredRepos(configPath)).toEqual([
      join(first, 'a-repo'), join(second, 'm-repo'), join(first, 'z-repo')
    ].sort())
  })

  it('requires toolai init before reading configured repo roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-centralize-config-'))
    tempRoots.push(root)
    const configPath = join(root, '.toolai', 'config.yaml')

    const {readConfiguredRepoRoots} = await import('../src/lib/centralize/inspect.js')

    await expect(readConfiguredRepoRoots(configPath)).rejects.toThrow('toolai is not initialized. Run toolai init first.')
  })
})
