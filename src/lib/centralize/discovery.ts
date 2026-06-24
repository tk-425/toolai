import {readdir} from 'node:fs/promises'
import path, {join, relative} from 'node:path'
import {getIgnoredPrefixes, isIgnored} from './gitignore.js'
import {readSkillMetadata} from './skill-metadata.js'
import type {DiscoveredSkill} from './types.js'

const EXCLUDED_SEGMENTS = new Set(['.git', 'node_modules', '.venv', 'dist', 'build', '.next', '.turbo', 'coverage'])

function hasExcludedSegment(repoPath: string, targetPath: string): boolean {
  return relative(repoPath, targetPath)
    .split(path.sep)
    .some(segment => EXCLUDED_SEGMENTS.has(segment))
}

async function collectSkills(
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

    await collectSkills(repoPath, fullPath, skills, ignoredPrefixes)
  }
}

export async function discoverSkills(sourceRepo: string): Promise<DiscoveredSkill[]> {
  const ignoredPrefixes = await getIgnoredPrefixes(sourceRepo)
  const rootSkill = await readSkillMetadata(sourceRepo, true)
  const nestedSkills: DiscoveredSkill[] = []
  await collectSkills(sourceRepo, sourceRepo, nestedSkills, ignoredPrefixes)

  let skills = rootSkill ? [rootSkill] : nestedSkills
  const preferredRoot = join(sourceRepo, 'skills')
  const preferred = skills.filter(skill => skill.path.startsWith(`${preferredRoot}${path.sep}`))
  if (preferred.length > 0) skills = preferred

  const topLevelCount = skills.filter(skill => !relative(sourceRepo, skill.path).includes(path.sep)).length
  const nestedCount = skills.length - topLevelCount
  if (topLevelCount > 0 && nestedCount > 0) {
    throw new Error('ambiguous discovery: found both top-level and nested skill directories')
  }

  const deduped = [...new Map(skills.map(skill => [skill.path, skill])).values()]
    .sort((a, b) => a.path.localeCompare(b.path))
  if (deduped.length === 0) throw new Error('no valid skills discovered')
  return deduped
}

