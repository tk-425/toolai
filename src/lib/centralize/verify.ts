import {createHash} from 'node:crypto'
import {lstat, readFile, readdir, readlink} from 'node:fs/promises'
import path, {basename, join} from 'node:path'
import type {VerificationResult} from './types.js'
import {discoverSkillDirs} from './discovery.js'

interface StoredInstallConfig {
  mode?: 'multi-skill-bundle-with-symlinks' | 'single-skill-direct-install'
  installType?: 'multi-skill-bundle-with-symlinks' | 'single-skill-direct-install'
  sourceRepo: string
  bundleName: string
  prefix: string
  discoveredSkills?: string[]
  installedSkills?: string[]
}

async function pathInfo(candidate: string) {
  try {
    return await lstat(candidate)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function normalizeSkillFrontmatter(contents: string): string {
  const lines = contents.split('\n')
  let inFrontmatter = false
  return lines.map(line => {
    const trimmedLine = line.trim()
    if (trimmedLine === '---') {
      inFrontmatter = !inFrontmatter
      return trimmedLine
    }
    if (inFrontmatter && /^name\s*:/.test(trimmedLine)) {
      const indentation = line.match(/^\s*/)?.[0] ?? ''
      return `${indentation}name: __toolai_normalized__`
    }
    return line
  }).join('\n')
}

async function hashFileContents(filePath: string, relativePath: string): Promise<string> {
  const contents = await readFile(filePath)
  const hash = createHash('sha256')
  const normalizedRelativePath = relativePath.split(path.sep).join('/')
  if (normalizedRelativePath.endsWith('SKILL.md')) {
    hash.update(normalizeSkillFrontmatter(contents.toString('utf8')))
  } else {
    hash.update(contents)
  }
  return hash.digest('hex')
}

async function resolveSymlinkTarget(linkPath: string): Promise<string> {
  const linkTarget = await readlink(linkPath)
  return path.resolve(path.dirname(linkPath), linkTarget)
}

async function collectDirectorySignature(rootDir: string, currentDir: string, entries: string[]): Promise<void> {
  const dirEntries = await readdir(currentDir, {withFileTypes: true}).catch(() => [])

  for (const entry of dirEntries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = join(currentDir, entry.name)
    const relativePath = path.relative(rootDir, fullPath)
    if (relativePath === '.centralize-config.json') continue

    if (entry.isDirectory()) {
      entries.push(`dir:${relativePath}`)
      await collectDirectorySignature(rootDir, fullPath, entries)
      continue
    }

    if (entry.isSymbolicLink()) {
      entries.push(`symlink:${relativePath}:${await resolveSymlinkTarget(fullPath)}`)
      continue
    }

    if (entry.isFile()) {
      entries.push(`file:${relativePath}:${await hashFileContents(fullPath, relativePath)}`)
    }
  }
}

export async function directoriesDiffer(sourceDir: string, targetDir: string): Promise<boolean> {
  const targetInfo = await pathInfo(targetDir)
  if (!targetInfo?.isDirectory()) return true

  const sourceEntries: string[] = []
  const targetEntries: string[] = []
  await collectDirectorySignature(sourceDir, sourceDir, sourceEntries)
  await collectDirectorySignature(targetDir, targetDir, targetEntries)

  if (sourceEntries.length !== targetEntries.length) return true
  return sourceEntries.some((entry, index) => entry !== targetEntries[index])
}

async function readStoredInstallConfig(installRoot: string): Promise<StoredInstallConfig> {
  const contents = await readFile(join(installRoot, '.centralize-config.json'), 'utf8')
  return JSON.parse(contents) as StoredInstallConfig
}

export async function verifyInstallContentMatchesSource(installRoot: string): Promise<VerificationResult> {
  const config = await readStoredInstallConfig(installRoot)
  const discoveredSkills = config.discoveredSkills ?? []
  const installedSkills = config.installedSkills ?? []
  const sourceSkillDirs = await discoverSkillDirs(config.sourceRepo)
  const sourceSkillMap = new Map(sourceSkillDirs.map(dir => [basename(dir), dir]))
  const failures: string[] = []
  const checkedPaths: string[] = []
  const mode = config.mode ?? config.installType

  for (let index = 0; index < discoveredSkills.length; index++) {
    const discoveredSkill = discoveredSkills[index]
    const installedSkill = installedSkills[index]
    const sourcePath = sourceSkillMap.get(discoveredSkill)
    const targetPath = mode === 'single-skill-direct-install'
      ? installRoot
      : join(installRoot, installedSkill)

    checkedPaths.push(targetPath)

    if (!sourcePath || await directoriesDiffer(sourcePath, targetPath)) {
      failures.push(targetPath)
    }
  }

  return {
    ok: failures.length === 0,
    checkedPaths,
    failures
  }
}

export async function verifyConfigPresence(
  installedRoots: string[],
  pathExists: (path: string) => Promise<boolean>
): Promise<VerificationResult> {
  const failures: string[] = []

  for (const root of installedRoots) {
    const configPath = `${root}/.centralize-config.json`
    if (!(await pathExists(configPath))) failures.push(configPath)
  }

  return {
    ok: failures.length === 0,
    checkedPaths: installedRoots,
    failures
  }
}

export async function verifyAliasTargets(
  aliases: string[],
  isSymlink: (path: string) => Promise<boolean>,
  readLink: (path: string) => Promise<string>
): Promise<VerificationResult> {
  const failures: string[] = []

  for (const alias of aliases) {
    if (!(await isSymlink(alias))) {
      failures.push(alias)
      continue
    }

    try {
      await readLink(alias)
    } catch {
      failures.push(alias)
    }
  }

  return {
    ok: failures.length === 0,
    checkedPaths: aliases,
    failures
  }
}
