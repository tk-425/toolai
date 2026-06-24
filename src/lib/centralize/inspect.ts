import {readdir, readFile} from 'node:fs/promises'
import {basename, join, relative} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {TOOLAI_CONFIG_PATH} from '../config/paths.js'
import {getConfiguredCentralizeRepoRoot} from '../config/toolai-config.js'
import {resolvePath} from '../fs/path-helpers.js'
import {getIgnoredPrefixes, isIgnored} from './gitignore.js'
import {readSkillMetadata} from './skill-metadata.js'
import type {CentralizedInstall, DiscoveredSkill, RepoInspection, RepoLayout} from './types.js'

const execFileAsync = promisify(execFile)
const EXCLUDED_SEGMENTS = new Set(['.git', 'node_modules', '.venv', 'dist', 'build', '.next', '.turbo', 'coverage'])

export {resolvePath}

function hasExcludedSegment(repoPath: string, targetPath: string): boolean {
  return relative(repoPath, targetPath)
    .split('/')
    .some(segment => EXCLUDED_SEGMENTS.has(segment))
}

async function collectNestedSkills(
  repoPath: string,
  currentPath: string,
  skills: DiscoveredSkill[],
  ignoredPrefixes: Set<string>
): Promise<void> {
  const entries = await readdir(currentPath, {withFileTypes: true})

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const fullPath = join(currentPath, entry.name)
    if (hasExcludedSegment(repoPath, fullPath)) continue
    if (isIgnored(repoPath, fullPath, ignoredPrefixes)) continue

    const skill = await readSkillMetadata(fullPath, false)
    if (skill) {
      skills.push(skill)
      continue
    }

    await collectNestedSkills(repoPath, fullPath, skills, ignoredPrefixes)
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

export async function readConfiguredRepoRoots(configPath = TOOLAI_CONFIG_PATH): Promise<string[]> {
  return [resolvePath(await getConfiguredCentralizeRepoRoot(configPath))]
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

export async function discoverConfiguredRepos(configPath = TOOLAI_CONFIG_PATH): Promise<string[]> {
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
  const ignoredPrefixes = await getIgnoredPrefixes(repoPath)
  const rootSkill = await readSkillMetadata(repoPath, true)

  const nestedSkills: DiscoveredSkill[] = []
  await collectNestedSkills(repoPath, repoPath, nestedSkills, ignoredPrefixes)

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
