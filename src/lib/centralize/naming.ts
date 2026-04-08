import {basename} from 'node:path'
import type {ConflictRecord, PublishTargets} from './types.js'

export function getDefaultBundleName(repoPath: string): string {
  return basename(repoPath)
}

export function applyPrefix(name: string, prefix: string | null): string {
  if (!prefix) return name
  return name.startsWith(`${prefix}-`) ? name : `${prefix}-${name}`
}

export async function detectConflicts(
  input: PublishTargets & {
    centralRoot: string
    pathExists: (path: string) => Promise<boolean>
  }
): Promise<ConflictRecord[]> {
  const conflicts: ConflictRecord[] = []

  for (const path of input.installRoots) {
    if (await input.pathExists(path)) conflicts.push({path, type: 'install-root'})
  }

  for (const path of input.topLevelAliases) {
    if (await input.pathExists(path)) conflicts.push({path, type: 'alias'})
  }

  return conflicts
}
