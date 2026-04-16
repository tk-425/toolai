import {access} from 'node:fs/promises'
import type {Scope} from '../link/types.js'
import {getConfiguredPlatforms, type ToolaiPlatformConfig} from './toolai-config.js'

export interface PlatformTargetEntry {
  label: string
  path: string
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate)
    return true
  } catch {
    return false
  }
}

const PROJECT_PLATFORM_ROOTS = new Map([
  ['Claude Code', '.claude'],
  ['Codex', '.codex'],
  ['Gemini', '.gemini'],
  ['Cursor', '.cursor'],
  ['Antigravity', '.agents'],
  ['OpenCode', '.opencode'],
  ['Qwen', '.qwen']
])

export async function buildPlatformTargets(
  scope: Scope,
  kind: 'skills' | 'agents',
  platforms: ToolaiPlatformConfig[],
  projectRootExists: (path: string) => Promise<boolean> = pathExists
): Promise<PlatformTargetEntry[]> {
  const suffix = kind === 'skills' ? 'skills' : 'agents'

  if (scope === 'project') {
    const entries = await Promise.all(
      [...PROJECT_PLATFORM_ROOTS.entries()].map(async ([label, root]) => (
        await projectRootExists(root)
          ? {label, path: `${root}/${suffix}`}
          : null
      ))
    )
    return entries.filter(entry => entry !== null)
  }

  return platforms.map(platform => ({
    label: platform.label,
    path: `${platform.base}/${suffix}`
  }))
}

export async function getSkillTargets(scope: Scope): Promise<PlatformTargetEntry[]> {
  return buildPlatformTargets(scope, 'skills', await getConfiguredPlatforms())
}

export async function getAgentTargets(scope: Scope): Promise<PlatformTargetEntry[]> {
  return buildPlatformTargets(scope, 'agents', await getConfiguredPlatforms())
}
