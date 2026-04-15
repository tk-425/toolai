import {access, mkdir, readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {TOOLAI_CONFIG_PATH} from './paths.js'
import {resolvePath} from '../fs/path-helpers.js'

export interface ToolaiConfig {
  skillsRoot: string
  agentsRoot: string
  centralizeRepoRoot: string
}

export class ToolaiConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolaiConfigError'
  }
}

const DEFAULT_TOOLAI_CONFIG_TEMPLATE = `# toolai configuration

paths:
  skills-root:
  agents-root:

centralize:
  skills-dirs:
`

export function getToolaiConfigPath(configPath = TOOLAI_CONFIG_PATH): string {
  return resolvePath(configPath)
}

export async function toolaiConfigExists(configPath = TOOLAI_CONFIG_PATH): Promise<boolean> {
  try {
    await access(getToolaiConfigPath(configPath))
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function ensureToolaiConfig(configPath = TOOLAI_CONFIG_PATH): Promise<{
  configPath: string
  created: boolean
}> {
  const resolvedConfigPath = getToolaiConfigPath(configPath)
  if (await toolaiConfigExists(resolvedConfigPath)) {
    return {configPath: resolvedConfigPath, created: false}
  }

  await mkdir(path.dirname(resolvedConfigPath), {recursive: true})
  await writeFile(resolvedConfigPath, DEFAULT_TOOLAI_CONFIG_TEMPLATE, 'utf8')
  return {configPath: resolvedConfigPath, created: true}
}

export async function readToolaiConfig(configPath = TOOLAI_CONFIG_PATH): Promise<ToolaiConfig> {
  const resolvedConfigPath = getToolaiConfigPath(configPath)
  const contents = await readFile(resolvedConfigPath, 'utf8')

  let inPaths = false
  let inCentralize = false
  let inSkillsDirs = false
  let skillsRoot = ''
  let agentsRoot = ''
  const repoRoots: string[] = []

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    if (line === 'paths:') {
      inPaths = true
      inCentralize = false
      inSkillsDirs = false
      continue
    }

    if (line === 'centralize:') {
      inCentralize = true
      inPaths = false
      inSkillsDirs = false
      continue
    }

    if (inPaths) {
      if (line.startsWith('skills-root:')) {
        skillsRoot = line.slice('skills-root:'.length).trim()
        continue
      }
      if (line.startsWith('agents-root:')) {
        agentsRoot = line.slice('agents-root:'.length).trim()
        continue
      }
    }

    if (inCentralize) {
      if (line === 'skills-dirs:') {
        inSkillsDirs = true
        continue
      }
      if (inSkillsDirs) {
        if (!line.startsWith('- ')) {
          inSkillsDirs = false
          continue
        }
        repoRoots.push(line.slice(2).trim())
      }
    }
  }

  return {
    skillsRoot,
    agentsRoot,
    centralizeRepoRoot: repoRoots[0] ?? ''
  }
}

export async function requireToolaiConfig(configPath = TOOLAI_CONFIG_PATH): Promise<ToolaiConfig> {
  if (!(await toolaiConfigExists(configPath))) {
    throw new ToolaiConfigError('toolai is not initialized. Run toolai init first.')
  }

  return readToolaiConfig(configPath)
}

export async function writeToolaiConfig(config: ToolaiConfig, configPath = TOOLAI_CONFIG_PATH): Promise<void> {
  const resolvedConfigPath = getToolaiConfigPath(configPath)
  await mkdir(path.dirname(resolvedConfigPath), {recursive: true})
  await writeFile(
    resolvedConfigPath,
    [
      '# toolai configuration',
      '',
      'paths:',
      `  skills-root: ${config.skillsRoot}`,
      `  agents-root: ${config.agentsRoot}`,
      '',
      'centralize:',
      '  skills-dirs:',
      `    - ${config.centralizeRepoRoot}`,
      ''
    ].join('\n'),
    'utf8'
  )
}

export async function getConfiguredSkillsRoot(configPath = TOOLAI_CONFIG_PATH): Promise<string> {
  const config = await requireToolaiConfig(configPath)
  if (!config.skillsRoot) {
    throw new ToolaiConfigError('toolai config is missing paths.skills-root. Run toolai init to update it.')
  }
  return config.skillsRoot
}

export async function getConfiguredAgentsRoot(configPath = TOOLAI_CONFIG_PATH): Promise<string> {
  const config = await requireToolaiConfig(configPath)
  if (!config.agentsRoot) {
    throw new ToolaiConfigError('toolai config is missing paths.agents-root. Run toolai init to update it.')
  }
  return config.agentsRoot
}

export async function getConfiguredCentralizeRepoRoot(configPath = TOOLAI_CONFIG_PATH): Promise<string> {
  const config = await requireToolaiConfig(configPath)
  if (!config.centralizeRepoRoot) {
    throw new ToolaiConfigError('toolai config is missing centralize.skills-dirs. Run toolai init to update it.')
  }
  return config.centralizeRepoRoot
}
