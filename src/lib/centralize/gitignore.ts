import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {relative} from 'node:path'

const execFileAsync = promisify(execFile)

export async function getIgnoredPrefixes(repoPath: string): Promise<Set<string>> {
  try {
    const {stdout} = await execFileAsync('git', [
      '-C', repoPath,
      'ls-files',
      '--ignored',
      '--exclude-standard',
      '--directory',
      '--others'
    ])

    const prefixes = new Set<string>()
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length === 0) continue
      // git appends trailing slash; strip it for consistent prefix matching
      prefixes.add(trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed)
    }
    return prefixes
  } catch {
    // git not available, not a repo, or other error — graceful fallback
    return new Set()
  }
}

export function isIgnored(
  repoPath: string,
  targetPath: string,
  ignoredPrefixes: Set<string>
): boolean {
  const relPath = relative(repoPath, targetPath)

  for (const prefix of ignoredPrefixes) {
    if (relPath === prefix || relPath.startsWith(prefix + '/')) {
      return true
    }
  }
  return false
}
