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

describe('init command', () => {
  it('bootstraps toolai config from interactive path prompts', async () => {
    const promptInput = vi.fn()
      .mockResolvedValueOnce('/central/skills')
      .mockResolvedValueOnce('/central/agents')
      .mockResolvedValueOnce('/repos/skills')
      .mockResolvedValueOnce('Claude Code 2')
      .mockResolvedValueOnce('~/.claude2')
      .mockResolvedValueOnce('Claude Code 3')
      .mockResolvedValueOnce('~/.claude3')
      .mockResolvedValueOnce('Code')
      .mockResolvedValueOnce('~/.code')
    const promptConfirm = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptInput,
      promptConfirm
    }))

    const root = await mkdtemp(join(tmpdir(), 'toolai-init-'))
    tempRoots.push(root)
    const configPath = join(root, '.toolai', 'config.yaml')

    vi.doMock('../src/lib/config/toolai-config.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/config/toolai-config.js')>('../src/lib/config/toolai-config.js')
      return {
        ...actual,
        getToolaiConfigPath: vi.fn().mockReturnValue(configPath),
        toolaiConfigExists: vi.fn().mockResolvedValue(false)
      }
    })

    const commandModule = await import('../src/commands/init.js')
    const command = new commandModule.default([], {} as never)
    const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

    await command.run()

    expect(promptInput).toHaveBeenCalledTimes(9)
    expect(promptInput).toHaveBeenCalledWith('What is the central skills location?', undefined)
    expect(promptInput).toHaveBeenCalledWith('What is the central agents location?', undefined)
    expect(promptInput).toHaveBeenCalledWith('What is the bundled source repo location?', undefined)
    expect(promptConfirm).toHaveBeenCalledWith('Would you like to add a custom platform?', false)
    expect(log).toHaveBeenCalledWith(expect.stringContaining(`Initialized toolai config at ${configPath}`))
    const contents = await readFile(configPath, 'utf8')
    expect(contents).toContain('skills-root: /central/skills')
    expect(contents).toContain('- label: Claude Code')
    expect(contents).toContain('- label: Claude Code 2')
    expect(contents).toContain('base: ~/.claude2')
    expect(contents).toContain('- label: Claude Code 3')
    expect(contents).toContain('- label: Code')
  })

  it('warns before overwriting an existing toolai config', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-init-existing-'))
    tempRoots.push(root)
    const configPath = join(root, '.toolai', 'config.yaml')
    await mkdir(join(root, '.toolai'), {recursive: true})
    await writeFile(configPath, 'paths:\n  skills-root: /existing/skills\n', 'utf8')

    const promptConfirm = vi.fn().mockResolvedValue(false)
    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptInput: vi.fn(),
      promptConfirm
    }))
    vi.doMock('../src/lib/config/toolai-config.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/config/toolai-config.js')>('../src/lib/config/toolai-config.js')
      return {
        ...actual,
        getToolaiConfigPath: vi.fn().mockReturnValue(configPath),
        toolaiConfigExists: vi.fn().mockResolvedValue(true)
      }
    })

    const commandModule = await import('../src/commands/init.js')
    const command = new commandModule.default([], {} as never)
    const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

    await command.run()

    expect(promptConfirm).toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(expect.stringContaining('toolai is already initialized'))
  })

  it('re-prompts on blank custom platform values and warns before replacing duplicate labels', async () => {
    const promptInput = vi.fn()
      .mockResolvedValueOnce('/central/skills')
      .mockResolvedValueOnce('/central/agents')
      .mockResolvedValueOnce('/repos/skills')
      .mockResolvedValueOnce('Code')
      .mockResolvedValueOnce('~/.code')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('Code')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('~/.code-next')
    const promptConfirm = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    vi.doMock('../src/lib/centralize/prompts.js', () => ({
      promptInput,
      promptConfirm
    }))

    const root = await mkdtemp(join(tmpdir(), 'toolai-init-duplicate-'))
    tempRoots.push(root)
    const configPath = join(root, '.toolai', 'config.yaml')

    vi.doMock('../src/lib/config/toolai-config.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/config/toolai-config.js')>('../src/lib/config/toolai-config.js')
      return {
        ...actual,
        getToolaiConfigPath: vi.fn().mockReturnValue(configPath),
        toolaiConfigExists: vi.fn().mockResolvedValue(false)
      }
    })

    const commandModule = await import('../src/commands/init.js')
    const command = new commandModule.default([], {} as never)
    const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

    await command.run()

    expect(promptConfirm).toHaveBeenCalledWith('Would you like to replace the existing platform "Code"?', false)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Platform label cannot be empty.'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Platform base path cannot be empty.'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Platform "Code" already exists and will be replaced.'))

    const contents = await readFile(configPath, 'utf8')
    expect(contents).toContain('- label: Code')
    expect(contents).toContain('base: ~/.code-next')
  })
})
