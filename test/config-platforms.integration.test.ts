import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach, describe, expect, it, vi} from 'vitest'

const tempRoots: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  vi.resetModules()
  await Promise.all(tempRoots.map(root => rm(root, {recursive: true, force: true})))
  tempRoots.length = 0
})

async function createConfigFile(root: string, contents: string) {
  const configPath = join(root, '.toolai', 'config.yaml')
  await mkdir(join(root, '.toolai'), {recursive: true})
  await writeFile(configPath, contents, 'utf8')
  return configPath
}

describe('config platforms commands', () => {
  it('lists configured custom global platforms', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-config-platforms-list-'))
    tempRoots.push(root)
    const configPath = await createConfigFile(root, `# toolai configuration

paths:
  skills-root: /central/skills
  agents-root: /central/agents

centralize:
  skills-dirs:
    - /repos/skills

platforms:
  - label: Code
    base: ~/.code
`)

    vi.doMock('../src/lib/config/toolai-config.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/config/toolai-config.js')>('../src/lib/config/toolai-config.js')
      return {
        ...actual,
        getToolaiConfigPath: vi.fn().mockReturnValue(configPath)
      }
    })

    const module = await import('../src/commands/config/platforms/list.js')
    const command = new module.default([], {} as never)
    const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

    await command.run()

    expect(log).toHaveBeenCalledWith(expect.stringContaining('Custom Platforms'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Code'))
  })

  it('adds a custom platform without changing built-in defaults', async () => {
    const promptInput = vi.fn()
      .mockResolvedValueOnce('Claude Code 2')
      .mockResolvedValueOnce('~/.claude2')
    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptInput,
      promptConfirm: vi.fn()
    }))

    const root = await mkdtemp(join(tmpdir(), 'toolai-config-platforms-add-'))
    tempRoots.push(root)
    const configPath = await createConfigFile(root, `# toolai configuration

paths:
  skills-root: /central/skills
  agents-root: /central/agents

centralize:
  skills-dirs:
    - /repos/skills

platforms:
  - label: Code
    base: ~/.code
`)

    vi.doMock('../src/lib/config/toolai-config.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/config/toolai-config.js')>('../src/lib/config/toolai-config.js')
      return {
        ...actual,
        getToolaiConfigPath: vi.fn().mockReturnValue(configPath)
      }
    })

    const module = await import('../src/commands/config/platforms/add.js')
    const command = new module.default([], {} as never)
    const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

    await command.run()

    const contents = await readFile(configPath, 'utf8')
    expect(contents).toContain('- label: Code')
    expect(contents).toContain('- label: Claude Code 2')
    expect(contents).not.toContain('- label: Claude Code\n')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Saved custom platform "Claude Code 2"'))
  })

  it('removes a selected custom platform', async () => {
    vi.doMock('../src/lib/centralize/prompts.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/centralize/prompts.js')>('../src/lib/centralize/prompts.js')
      return {
        ...actual,
        promptSelect: vi.fn().mockResolvedValue('Code')
      }
    })

    const root = await mkdtemp(join(tmpdir(), 'toolai-config-platforms-remove-'))
    tempRoots.push(root)
    const configPath = await createConfigFile(root, `# toolai configuration

paths:
  skills-root: /central/skills
  agents-root: /central/agents

centralize:
  skills-dirs:
    - /repos/skills

platforms:
  - label: Code
    base: ~/.code
  - label: Claude Code 2
    base: ~/.claude2
`)

    vi.doMock('../src/lib/config/toolai-config.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/config/toolai-config.js')>('../src/lib/config/toolai-config.js')
      return {
        ...actual,
        getToolaiConfigPath: vi.fn().mockReturnValue(configPath)
      }
    })

    const module = await import('../src/commands/config/platforms/remove.js')
    const command = new module.default([], {} as never)
    const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

    await command.run()

    const contents = await readFile(configPath, 'utf8')
    expect(contents).not.toContain('- label: Code')
    expect(contents).toContain('- label: Claude Code 2')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Removed custom platform "Code"'))
  })
})
