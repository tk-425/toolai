import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach, describe, expect, it} from 'vitest'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.map(root => rm(root, {recursive: true, force: true})))
  tempRoots.length = 0
})

describe('toolai config', () => {
  it('writes and reads initialized paths from a shared toolai config', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-config-'))
    tempRoots.push(root)
    const configPath = join(root, '.toolai', 'config.yaml')

    const {readToolaiConfig, writeToolaiConfig} = await import('../src/lib/config/toolai-config.js')
    await writeToolaiConfig({
      skillsRoot: '/central/skills',
      agentsRoot: '/central/agents',
      centralizeRepoRoot: '/repos/skills',
      platforms: [
        {label: 'Claude Code', base: '~/.claude'},
        {label: 'Code', base: '~/.code'}
      ]
    }, configPath)

    const loaded = await readToolaiConfig(configPath)
    const contents = await readFile(configPath, 'utf8')

    expect(loaded).toEqual({
      skillsRoot: '/central/skills',
      agentsRoot: '/central/agents',
      centralizeRepoRoot: '/repos/skills',
      platforms: [
        {label: 'Claude Code', base: '~/.claude'},
        {label: 'Code', base: '~/.code'}
      ]
    })
    expect(contents).toContain('skills-root: /central/skills')
    expect(contents).toContain('agents-root: /central/agents')
    expect(contents).toContain('- /repos/skills')
    expect(contents).toContain('platforms:')
    expect(contents).toContain('- label: Claude Code')
    expect(contents).toContain('base: ~/.claude')
    expect(contents).toContain('- label: Code')
    expect(contents).toContain('base: ~/.code')
  })

  it('treats stored platforms as custom entries layered on top of defaults', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-config-custom-'))
    tempRoots.push(root)
    const configPath = join(root, '.toolai', 'config.yaml')

    const {getConfiguredPlatforms, getStoredCustomPlatforms, writeToolaiConfig} = await import('../src/lib/config/toolai-config.js')
    await writeToolaiConfig({
      skillsRoot: '/central/skills',
      agentsRoot: '/central/agents',
      centralizeRepoRoot: '/repos/skills',
      platforms: [
        {label: 'Claude Code 2', base: '~/.claude2'},
        {label: 'Code', base: '~/.code'}
      ]
    }, configPath)

    expect(await getStoredCustomPlatforms(configPath)).toEqual([
      {label: 'Claude Code 2', base: '~/.claude2'},
      {label: 'Code', base: '~/.code'}
    ])
    expect(await getConfiguredPlatforms(configPath)).toEqual(expect.arrayContaining([
      {label: 'Claude Code', base: '~/.claude'},
      {label: 'Codex', base: '~/.codex'},
      {label: 'Claude Code 2', base: '~/.claude2'},
      {label: 'Code', base: '~/.code'}
    ]))
  })

  it('filters built-in platforms out of stored custom platform reads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-config-legacy-'))
    tempRoots.push(root)
    const configPath = join(root, '.toolai', 'config.yaml')

    const {getStoredCustomPlatforms, writeToolaiConfig} = await import('../src/lib/config/toolai-config.js')
    await writeToolaiConfig({
      skillsRoot: '/central/skills',
      agentsRoot: '/central/agents',
      centralizeRepoRoot: '/repos/skills',
      platforms: [
        {label: 'Claude Code', base: '~/.claude'},
        {label: 'Codex', base: '~/.codex'},
        {label: 'Code', base: '~/.code'}
      ]
    }, configPath)

    expect(await getStoredCustomPlatforms(configPath)).toEqual([
      {label: 'Code', base: '~/.code'}
    ])
  })

  it('strips inline comments from configured values', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-config-comments-'))
    tempRoots.push(root)
    const configPath = join(root, '.toolai', 'config.yaml')

    await mkdir(join(root, '.toolai'), {recursive: true})
    await writeFile(configPath, `# toolai configuration

paths:
  skills-root: /central/skills # canonical skills root
  agents-root: /central/agents # canonical agents root

centralize:
  skills-dirs:
    - /repos/skills # primary

platforms:
  - label: Code
    base: ~/.code # local code base
`, 'utf8')

    const {readToolaiConfig} = await import('../src/lib/config/toolai-config.js')
    const loaded = await readToolaiConfig(configPath)

    expect(loaded).toEqual({
      skillsRoot: '/central/skills',
      agentsRoot: '/central/agents',
      centralizeRepoRoot: '/repos/skills',
      platforms: [
        {label: 'Code', base: '~/.code'}
      ]
    })
  })

  it('rejects configs with multiple centralize repo roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-config-multi-root-'))
    tempRoots.push(root)
    const configPath = join(root, '.toolai', 'config.yaml')

    await mkdir(join(root, '.toolai'), {recursive: true})
    await writeFile(configPath, `# toolai configuration

paths:
  skills-root: /central/skills
  agents-root: /central/agents

centralize:
  skills-dirs:
    - /repos/skills
    - /repos/more-skills

platforms:
  - label: Code
    base: ~/.code
`, 'utf8')

    const {readToolaiConfig} = await import('../src/lib/config/toolai-config.js')

    await expect(readToolaiConfig(configPath)).rejects.toThrow(
      'toolai config supports only one centralize.skills-dirs entry'
    )
  })
})
