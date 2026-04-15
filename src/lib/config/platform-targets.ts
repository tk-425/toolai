import type {Scope} from '../link/types.js'
import {getConfiguredPlatforms, type ToolaiPlatformConfig} from './toolai-config.js'

export interface PlatformTargetEntry {
  label: string
  path: string
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

export function buildPlatformTargets(
  scope: Scope,
  kind: 'skills' | 'agents',
  platforms: ToolaiPlatformConfig[]
): PlatformTargetEntry[] {
  const suffix = kind === 'skills' ? 'skills' : 'agents'

  if (scope === 'project') {
    return platforms.flatMap(platform => {
      const root = PROJECT_PLATFORM_ROOTS.get(platform.label)
      if (!root) return []
      return [{label: platform.label, path: `${root}/${suffix}`}]
    })
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
