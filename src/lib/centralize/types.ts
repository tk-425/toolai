export type CentralizeMode = 'add' | 'update' | 'remove'
export type LayoutChoice = 'root-only' | 'nested-only' | 'both'
export type RepoSelectionMode = 'configured' | 'custom'
export type RepoLayout = 'root-only' | 'nested-only' | 'mixed-layout' | 'none'

export interface Choice<T extends string> {
  name: string
  value: T
  description?: string
}

export interface CentralizeRunner {
  run(): Promise<void>
}

export interface DiscoveredSkill {
  name: string
  path: string
  isRoot: boolean
}

export interface RepoInspection {
  repoPath: string
  layout: RepoLayout
  isGitRepo: boolean
  hasWorkingTreeChanges: boolean
  rootSkill: DiscoveredSkill | null
  nestedSkills: DiscoveredSkill[]
}

export interface ConflictRecord {
  path: string
  type: 'install-root' | 'alias'
}

export interface PublishTargets {
  installRoots: string[]
  topLevelAliases: string[]
}

export interface CentralizedInstall {
  kind: 'bundle' | 'standalone'
  mode: 'multi-skill-bundle-with-symlinks' | 'single-skill-direct-install'
  name: string
  prefix: string
  sourceRepo: string
  installedRoot: string
}

export interface VerificationResult {
  ok: boolean
  checkedPaths: string[]
  failures: string[]
}

export interface SkillDiff {
  added: string[]
  removed: string[]
}

export type RemovalTargetKind = 'bundle' | 'standalone' | 'skill-in-bundle'

export interface RemovalTarget {
  kind: RemovalTargetKind
  name: string
  bundleName?: string
}

export type RemovalTargetValue = `${RemovalTargetKind}:${string}`

export interface RemovalPlan {
  target: RemovalTarget
  paths: string[]
  manifestEntries: string[]
  configRewrite?: {
    configPath: string
    installedSkills: string[]
    discoveredSkills: string[]
  }
  removesBundle?: boolean
}

export interface RemovalSummary {
  target: RemovalTarget
  removedPaths: string[]
  removedManifestEntries: string[]
  skippedPaths: string[]
  message?: string
}
