import path from 'node:path'
import type {Scope} from '../link/types.js'
import {getConfiguredPlatforms, type ToolaiPlatformConfig} from './toolai-config.js'

export interface PlatformTargetEntry {
  label: string
  path: string
  resolvedPath: string
}

const PROJECT_PLATFORM_ROOTS = new Map([
  ['Claude Code', '.claude'],
  ['Codex', '.codex'],
  ['Gemini', '.gemini'],
  ['Cursor', '.cursor'],
  ['Agents', '.agents'],
  ['OpenCode', '.opencode'],
  ['Qwen', '.qwen'],
  ['Pi', '.pi'],
  ['OMP', '.omp']
])

export async function buildPlatformTargets(
  scope: Scope,
  kind: 'skills' | 'agents',
  platforms: ToolaiPlatformConfig[],
  _projectRootExists?: (path: string) => Promise<boolean>,
  cwd = process.cwd()
): Promise<PlatformTargetEntry[]> {
  const suffix = kind === 'skills' ? 'skills' : 'agents'

  if (scope === 'project') {
    const projectRoot = path.resolve(cwd)
    return [...PROJECT_PLATFORM_ROOTS.entries()].map(([label, root]) => ({
      label,
      path: `${root}/${suffix}`,
      resolvedPath: path.join(projectRoot, root, suffix)
    }))
  }

  return platforms.map(platform => ({
    label: platform.label,
    path: `${platform.base}/${suffix}`,
    resolvedPath: `${platform.base}/${suffix}`
  }))
}

export async function getSkillTargets(scope: Scope): Promise<PlatformTargetEntry[]> {
  return buildPlatformTargets(scope, 'skills', await getConfiguredPlatforms())
}

export async function getAgentTargets(scope: Scope): Promise<PlatformTargetEntry[]> {
  return buildPlatformTargets(scope, 'agents', await getConfiguredPlatforms())
}
