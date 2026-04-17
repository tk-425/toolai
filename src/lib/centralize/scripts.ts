import {readCentralizedConfig, resolvePath} from './inspect.js'
import {
  listCentralizedInstalls as listCentralizedInstallsNative,
  publishSkills,
  refreshSkills,
  type PublishPreview
} from './engine.js'
import type {CentralizedInstall} from './types.js'

export type {PublishPreview} from './engine.js'

export interface UpstreamStatus {
  state: 'up_to_date' | 'behind' | 'no_upstream' | 'check_failed'
  behindCount?: number
  upstreamRef?: string
  message?: string
}

export function buildRefreshArgs(installedRoot: string, dryRun: boolean): string[] {
  return dryRun ? ['--dry-run', installedRoot] : [installedRoot]
}

export function parseInstalledItems(stdout: string): CentralizedInstall[] {
  return stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [kind, name, prefix, sourceRepo, installedRoot] = line.split('\t')
      const normalizedKind = kind === 'bundle' ? 'bundle' : 'standalone'

      return {
        kind: normalizedKind,
        mode: normalizedKind === 'bundle' ? 'multi-skill-bundle-with-symlinks' : 'single-skill-direct-install',
        name,
        prefix,
        sourceRepo,
        installedRoot
      }
    })
}

export async function listCentralizedInstalls(): Promise<CentralizedInstall[]> {
  const installs = await listCentralizedInstallsNative()
  return Promise.all(installs.map(async install => {
    try {
      return await readCentralizedConfig(install.installedRoot)
    } catch {
      return install
    }
  }))
}

export function buildPublishArgs(sourceRepo: string, bundleName?: string, prefix?: string, dryRun = false): string[] {
  const args: string[] = []
  if (dryRun) args.push('--dry-run')
  args.push(sourceRepo)
  if (bundleName) args.push(bundleName)
  if (prefix) args.push(prefix)
  return args
}

export async function runPublish(sourceRepo: string, bundleName?: string, prefix?: string, dryRun = false): Promise<string> {
  const preview = await publishSkills(sourceRepo, bundleName, prefix, dryRun)
  return JSON.stringify(preview, null, 2)
}

export async function runRefresh(installedRoot: string, dryRun = false): Promise<string> {
  const preview = await refreshSkills(installedRoot, dryRun)
  return JSON.stringify(preview, null, 2)
}

export async function pullLatest(repoPath: string): Promise<string> {
  const {execFile} = await import('node:child_process')
  const {promisify} = await import('node:util')
  const execFileAsync = promisify(execFile)
  const {stdout} = await execFileAsync('git', ['-C', repoPath, 'pull'])
  return stdout.trim()
}

export async function inspectUpstreamStatus(repoPath: string): Promise<UpstreamStatus> {
  const {execFile} = await import('node:child_process')
  const {promisify} = await import('node:util')
  const execFileAsync = promisify(execFile)

  try {
    const {stdout: upstreamStdout} = await execFileAsync('git', ['-C', repoPath, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
    const upstreamRef = upstreamStdout.trim()
    if (!upstreamRef) return {state: 'no_upstream'}

    try {
      await execFileAsync('git', ['-C', repoPath, 'fetch'])
      const {stdout: countStdout} = await execFileAsync('git', ['-C', repoPath, 'rev-list', '--left-right', '--count', `HEAD...${upstreamRef}`])
      const [aheadRaw, behindRaw] = countStdout.trim().split('\t')
      const behindCount = Number(behindRaw ?? '0')
      const aheadCount = Number(aheadRaw ?? '0')

      if (Number.isNaN(behindCount) || Number.isNaN(aheadCount)) {
        return {state: 'check_failed', message: 'Could not determine local vs upstream commit counts.'}
      }

      return behindCount > 0
        ? {state: 'behind', behindCount, upstreamRef}
        : {state: 'up_to_date', behindCount: 0, upstreamRef}
    } catch (error) {
      return {
        state: 'check_failed',
        upstreamRef,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  } catch {
    return {state: 'no_upstream'}
  }
}

export function parsePublishPreview(output: string): PublishPreview | null {
  let searchFrom = 0
  while (true) {
    const start = output.indexOf('{', searchFrom)
    if (start === -1) return null

    let depth = 0
    let inString = false
    let isEscaped = false
    let end = -1
    for (let i = start; i < output.length; i++) {
      const character = output[i]

      if (inString) {
        if (isEscaped) {
          isEscaped = false
          continue
        }

        if (character === '\\') {
          isEscaped = true
          continue
        }

        if (character === '"') inString = false
        continue
      }

      if (character === '"') {
        inString = true
        continue
      }

      if (character === '{') depth++
      else if (character === '}') {
        if (--depth === 0) { end = i + 1; break }
      }
    }

    if (end === -1) return null

    try {
      return JSON.parse(output.slice(start, end)) as PublishPreview
    } catch {
      searchFrom = start + 1
    }
  }
}
