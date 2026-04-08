import {readdir, readFile, stat} from 'node:fs/promises'
import {basename, join, relative} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import os from 'node:os'
import path from 'node:path'
import {CENTRALIZE_CONFIG_PATH} from '../config/paths.js'
import type {CentralizedInstall, DiscoveredSkill, RepoInspection, RepoLayout} from './types.js'

const execFileAsync = promisify(execFile)
const EXCLUDED_SEGMENTS = new Set(['.git', 'node_modules', '.venv', 'dist', 'build', '.next', '.turbo', 'coverage'])

async function hasSkillFile(path: string): Promise<boolean> {
  try {
    const info = await stat(join(path, 'SKILL.md'))
    return info.isFile()
  } catch {
    return false
  }
}

function hasExcludedSegment(repoPath: string, targetPath: string): boolean {
  return relative(repoPath, targetPath)
    .split('/')
    .some(segment => EXCLUDED_SEGMENTS.has(segment))
}

async function collectNestedSkills(repoPath: string, currentPath: string, skills: DiscoveredSkill[]): Promise<void> {
  const entries = await readdir(currentPath, {withFileTypes: true})

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const fullPath = join(currentPath, entry.name)
    if (hasExcludedSegment(repoPath, fullPath)) continue

    if (await hasSkillFile(fullPath)) {
      skills.push({name: basename(fullPath), path: fullPath, isRoot: false})
      continue
    }

    await collectNestedSkills(repoPath, fullPath, skills)
  }
}

async function detectGitRepo(repoPath: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['-C', repoPath, 'rev-parse', '--is-inside-work-tree'])
    return true
  } catch {
    return false
  }
}

async function detectWorkingTreeChanges(repoPath: string): Promise<boolean> {
  try {
    const {stdout} = await execFileAsync('git', ['-C', repoPath, 'status', '--short'])
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

export function resolvePath(value: string): string {
  if (value.startsWith('~')) return path.join(os.homedir(), value.slice(1))
  return path.resolve(value)
}

export async function readConfiguredRepoRoots(configPath = CENTRALIZE_CONFIG_PATH): Promise<string[]> {
  const resolvedConfigPath = resolvePath(configPath)
  const contents = await readFile(resolvedConfigPath, 'utf8')
  const roots: string[] = []
  let inSkillsDirs = false

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (line === 'skills-dirs:') {
      inSkillsDirs = true
      continue
    }

    if (inSkillsDirs) {
      if (!line.startsWith('- ')) break
      roots.push(resolvePath(line.slice(2).trim()))
    }
  }

  return roots
}

async function findGitReposUnder(root: string, depth: number, repos: Set<string>): Promise<void> {
  if (depth < 0) return

  const entries = await readdir(root, {withFileTypes: true}).catch(() => [])
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const fullPath = join(root, entry.name)
    if (entry.name === '.git') {
      repos.add(root)
      continue
    }

    await findGitReposUnder(fullPath, depth - 1, repos)
  }
}

export async function discoverConfiguredRepos(configPath = CENTRALIZE_CONFIG_PATH): Promise<string[]> {
  const roots = await readConfiguredRepoRoots(configPath)
  const repos = new Set<string>()

  for (const root of roots) {
    await findGitReposUnder(root, 3, repos)
  }

  return [...repos].sort()
}

export async function readCentralizedConfig(installRoot: string): Promise<CentralizedInstall> {
  const configPath = join(installRoot, '.centralize-config.json')
  const contents = await readFile(configPath, 'utf8')
  const parsed = JSON.parse(contents) as {
    mode?: CentralizedInstall['mode']
    installType?: CentralizedInstall['mode']
    sourceRepo: string
    bundleName: string
    prefix: string
  }
  const mode = parsed.mode ?? parsed.installType
  if (!mode) {
    throw new Error(`centralized config is missing mode/installType: ${configPath}`)
  }

  return {
    kind: mode === 'multi-skill-bundle-with-symlinks' ? 'bundle' : 'standalone',
    mode,
    name: basename(installRoot),
    prefix: parsed.prefix ?? '',
    sourceRepo: parsed.sourceRepo,
    installedRoot: installRoot
  }
}

export async function inspectRepo(repoPath: string): Promise<RepoInspection> {
  const rootSkill = (await hasSkillFile(repoPath))
    ? {name: basename(repoPath), path: repoPath, isRoot: true}
    : null

  const nestedSkills: DiscoveredSkill[] = []
  await collectNestedSkills(repoPath, repoPath, nestedSkills)

  let layout: RepoLayout = 'none'
  if (rootSkill && nestedSkills.length > 0) layout = 'mixed-layout'
  else if (rootSkill) layout = 'root-only'
  else if (nestedSkills.length > 0) layout = 'nested-only'

  const [isGitRepo, hasWorkingTreeChanges] = await Promise.all([
    detectGitRepo(repoPath),
    detectWorkingTreeChanges(repoPath)
  ])

  return {
    repoPath,
    layout,
    isGitRepo,
    hasWorkingTreeChanges,
    rootSkill,
    nestedSkills
  }
}
