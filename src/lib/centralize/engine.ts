import {formatSectionLabel, formatWarning} from '../link/theme.js'
import type {
  CentralizeMode,
  CentralizedInstall,
  LayoutChoice,
  RepoInspection,
  RepoSelectionMode,
  VerificationResult
} from './types.js'

export interface CentralizeFlowDeps {
  promptMode: () => Promise<CentralizeMode>
  promptRepoSelectionMode?: () => Promise<RepoSelectionMode>
  promptConfiguredRepo?: () => Promise<string>
  promptCustomRepo?: () => Promise<string>
  promptLayoutChoice?: (inspection: RepoInspection) => Promise<LayoutChoice>
  promptBundleName?: (defaultName: string) => Promise<string>
  promptPrefix?: () => Promise<string | null>
  promptInstalledItem?: (items: CentralizedInstall[]) => Promise<CentralizedInstall>
  promptPullFirst?: () => Promise<boolean>
  promptConfirm: () => Promise<boolean>
  inspectRepo?: (repoPath: string) => Promise<RepoInspection>
  detectConflicts?: () => Promise<unknown[]>
  publish?: () => Promise<void>
  verifyPublish?: () => Promise<VerificationResult>
  listCentralizedInstalls?: () => Promise<CentralizedInstall[]>
  previewRefresh?: (installedRoot: string) => Promise<string>
  refreshInstall?: (installedRoot: string) => Promise<void>
  verifyRefresh?: () => Promise<VerificationResult>
  isGitRepo?: (path: string) => Promise<boolean>
  render: (line: string) => void
}

export async function runCentralizeFlow(deps: CentralizeFlowDeps): Promise<void> {
  const mode = await deps.promptMode()

  if (mode === 'add') {
    const repoMode = await deps.promptRepoSelectionMode?.()
    const repoPath = repoMode === 'custom'
      ? await deps.promptCustomRepo?.()
      : await deps.promptConfiguredRepo?.()

    const inspection = repoPath ? await deps.inspectRepo?.(repoPath) : undefined
    deps.render(formatSectionLabel('Inspection'))
    if (inspection) deps.render(`Repo: ${inspection.repoPath}`)

    const conflicts = await deps.detectConflicts?.()
    if (conflicts && conflicts.length > 0) {
      deps.render(formatWarning('Conflicts detected.'))
      return
    }

    deps.render(formatSectionLabel('Publish plan'))

    if (await deps.promptConfirm()) {
      await deps.publish?.()
      const verification = await deps.verifyPublish?.()
      if (verification) deps.render(`Verified: ${verification.ok ? 'yes' : 'no'}`)
    }

    return
  }

  const installs = await deps.listCentralizedInstalls?.() ?? []
  const selected = await deps.promptInstalledItem?.(installs)
  if (!selected) return

  const canPull = await deps.isGitRepo?.(selected.sourceRepo)
  if (canPull) await deps.promptPullFirst?.()

  const preview = await deps.previewRefresh?.(selected.installedRoot)
  if (preview) deps.render(preview)

  if (await deps.promptConfirm()) {
    await deps.refreshInstall?.(selected.installedRoot)
    const verification = await deps.verifyRefresh?.()
    if (verification) deps.render(`Verified: ${verification.ok ? 'yes' : 'no'}`)
  }
}
