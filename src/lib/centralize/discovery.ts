import {lstat, readdir} from 'node:fs/promises'
import path, {join, relative} from 'node:path'
import {getIgnoredPrefixes, isIgnored} from './gitignore.js'

const EXCLUDED_SEGMENTS = new Set(['.git', 'node_modules', '.venv', 'dist', 'build', '.next', '.turbo', 'coverage'])

async function pathInfo(candidate: string) {
  try {
    return await lstat(candidate)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function hasSkillFile(dir: string): Promise<boolean> {
  const info = await pathInfo(join(dir, 'SKILL.md'))
  return Boolean(info?.isFile())
}

function hasExcludedSegment(repoPath: string, targetPath: string): boolean {
  return relative(repoPath, targetPath)
    .split(path.sep)
    .some(segment => EXCLUDED_SEGMENTS.has(segment))
}

async function collectSkillDirs(
  repoPath: string,
  currentPath: string,
  skills: string[],
  ignoredPrefixes: Set<string>
): Promise<void> {
  const entries = await readdir(currentPath, {withFileTypes: true})

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const fullPath = join(currentPath, entry.name)
    if (hasExcludedSegment(repoPath, fullPath)) continue
    if (isIgnored(repoPath, fullPath, ignoredPrefixes)) continue

    if (await hasSkillFile(fullPath)) {
      skills.push(fullPath)
      continue
    }

    await collectSkillDirs(repoPath, fullPath, skills, ignoredPrefixes)
  }
}

export async function discoverSkillDirs(sourceRepo: string): Promise<string[]> {
  const ignoredPrefixes = await getIgnoredPrefixes(sourceRepo)
  const rootHasSkill = await hasSkillFile(sourceRepo)
  const nestedSkills: string[] = []
  await collectSkillDirs(sourceRepo, sourceRepo, nestedSkills, ignoredPrefixes)

  let skillDirs = rootHasSkill ? [sourceRepo] : nestedSkills
  const preferredRoot = join(sourceRepo, 'skills')
  const preferred = skillDirs.filter(dir => dir.startsWith(`${preferredRoot}${path.sep}`))
  if (preferred.length > 0) skillDirs = preferred

  const topLevelCount = skillDirs.filter(dir => !relative(sourceRepo, dir).includes(path.sep)).length
  const nestedCount = skillDirs.length - topLevelCount
  if (topLevelCount > 0 && nestedCount > 0) {
    throw new Error('ambiguous discovery: found both top-level and nested skill directories')
  }

  const deduped = [...new Set(skillDirs)].sort()
  if (deduped.length === 0) throw new Error('no valid skills discovered')
  return deduped
}
