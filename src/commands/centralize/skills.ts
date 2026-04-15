import {Command} from '@oclif/core'
import {lstat, readFile} from 'node:fs/promises'
import path from 'node:path'
import {detectConflicts, getDefaultBundleName} from '../../lib/centralize/naming.js'
import {discoverConfiguredRepos, inspectRepo, resolvePath} from '../../lib/centralize/inspect.js'
import {
  diffSkills,
  formatInspectionSummary,
  formatPreviewSummary,
  formatPublishPlanSummary,
  formatPublishSummary,
  formatSyncSummary
} from '../../lib/centralize/output.js'
import {
  listCentralizedInstalls,
  parsePublishPreview,
  pullLatest,
  runPublish,
  runRefresh
} from '../../lib/centralize/scripts.js'
import {getConfiguredSkillsRoot} from '../../lib/config/toolai-config.js'
import {ToolaiConfigError} from '../../lib/config/toolai-config.js'
import {
  buildModeChoices,
  buildRepoSelectionChoices,
  promptConfirm,
  promptInput,
  promptSelect
} from '../../lib/centralize/prompts.js'
import {verifyConfigPresence} from '../../lib/centralize/verify.js'
import {getCancelMessage, PromptCancelled} from '../../lib/link/prompts.js'
import {formatSectionLabel, formatSuccess, formatWarning} from '../../lib/link/theme.js'

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await lstat(candidate)
    return true
  } catch {
    return false
  }
}

function printLines(log: Command['log'], lines: string[]): void {
  for (const line of lines) log(line)
}

async function readStoredCentralizeConfig(installRoot: string): Promise<{
  mode?: string
  installType?: string
  bundleName?: string
  prefix?: string
  discoveredSkills?: string[]
  installedSkills?: string[]
  skills?: string[]
}> {
  const contents = await readFile(path.join(installRoot, '.centralize-config.json'), 'utf8')
  return JSON.parse(contents) as {
    mode?: string
    installType?: string
    bundleName?: string
    prefix?: string
    discoveredSkills?: string[]
    installedSkills?: string[]
    skills?: string[]
  }
}

function sameStringArray(a: string[] = [], b: string[] = []): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function normalizePrefix(prefix?: string): string {
  if (!prefix) return ''
  return prefix.endsWith('-') ? prefix : `${prefix}-`
}

function previewMatchesStoredConfig(
  preview: ReturnType<typeof parsePublishPreview>,
  storedConfig: Awaited<ReturnType<typeof readStoredCentralizeConfig>>
): boolean {
  if (!preview) return false

  const storedMode = storedConfig.mode ?? storedConfig.installType
  const storedDiscoveredSkills = storedConfig.discoveredSkills ?? storedConfig.skills ?? []
  const storedInstalledSkills = storedConfig.installedSkills ?? storedConfig.skills ?? []
  return (
    storedMode === preview.mode &&
    (storedConfig.bundleName ?? '') === preview.bundleName &&
    normalizePrefix(storedConfig.prefix) === normalizePrefix(preview.prefix) &&
    sameStringArray(storedDiscoveredSkills, preview.discoveredSkills) &&
    sameStringArray(storedInstalledSkills, preview.installedSkills)
  )
}

async function selectPrefix(command: Command, suggestedPrefix: string): Promise<string | undefined> {
  const choice = await promptSelect('What would you like to use for the prefix?', [
    {name: `Use suggested prefix: ${suggestedPrefix}`, value: 'suggested', description: 'recommended default'},
    {name: 'Enter a custom prefix', value: 'custom'},
    {name: 'No prefix', value: 'none'}
  ])

  if (choice === 'suggested') return suggestedPrefix
  if (choice === 'custom') {
    const custom = (await promptInput('Enter the custom prefix')).trim()
    return custom || undefined
  }

  return undefined
}

export async function runUpdateFlow(command: Command): Promise<void> {
  const installs = await listCentralizedInstalls()
  if (installs.length === 0) {
    command.log(formatWarning('No centralized installs were found.'))
    return
  }

  const selectedRoot = await promptSelect(
    'Which centralized install would you like to update?',
    installs.map(install => ({
      name: `${install.kind === 'bundle' ? '[Bundle]' : '[Standalone]'} ${install.name} ${install.prefix ? `prefix: "${install.prefix}"` : 'prefix: ""'} ${install.sourceRepo}`,
      value: install.installedRoot
    }))
  )

  const selected = installs.find(install => install.installedRoot === selectedRoot)
  if (!selected) return

  const sourceInspection = await inspectRepo(resolvePath(selected.sourceRepo)).catch(() => undefined)
  const storedConfig = await readStoredCentralizeConfig(selected.installedRoot).catch(() => null)
  const usesLegacyRefreshCompat = Boolean(storedConfig && !storedConfig.mode && storedConfig.installType)
  const initialPreview = usesLegacyRefreshCompat
    ? await runPublish(
        resolvePath(selected.sourceRepo),
        storedConfig?.bundleName ?? selected.name,
        storedConfig?.prefix,
        true
      )
    : await runRefresh(selected.installedRoot, true)
  const initialParsedPreview = parsePublishPreview(initialPreview)
  if (!initialParsedPreview || !storedConfig) {
    printLines(command.log.bind(command), [
      formatSectionLabel('Preview'),
      initialPreview || '(no preview output)'
    ])
    command.log(formatWarning('Could not summarize the preview.'))
    return
  }

  const storedInstalledSkills = storedConfig.installedSkills ?? storedConfig.skills ?? []
  const initialDiff = diffSkills(storedInstalledSkills, initialParsedPreview.installedSkills)
  const noSkillChangesDetected = initialDiff.added.length === 0 && initialDiff.removed.length === 0

  printLines(command.log.bind(command), formatPreviewSummary(selected, initialParsedPreview, initialDiff))

  let didPullLatest = false
  if (sourceInspection?.isGitRepo) {
    const shouldPull = await promptConfirm('Pull latest changes from the source repo first?', false)
    if (shouldPull) {
      didPullLatest = true
      const pullOutput = await pullLatest(resolvePath(selected.sourceRepo))
      if (pullOutput && !pullOutput.includes('Already up to date.')) command.log(pullOutput)
    }
  }

  let finalPreview = initialParsedPreview
  let diff = initialDiff
  if (didPullLatest) {
    const preview = usesLegacyRefreshCompat
      ? await runPublish(
          resolvePath(selected.sourceRepo),
          storedConfig.bundleName ?? selected.name,
          storedConfig.prefix,
          true
        )
      : await runRefresh(selected.installedRoot, true)
    const refreshedPreview = parsePublishPreview(preview)
    if (!refreshedPreview) {
      printLines(command.log.bind(command), [
        formatSectionLabel('Preview'),
        preview || '(no preview output)'
      ])
      command.log(formatWarning('Could not summarize the preview after pull.'))
      return
    }

    finalPreview = refreshedPreview
    diff = diffSkills(storedInstalledSkills, finalPreview.installedSkills)
    printLines(command.log.bind(command), formatPreviewSummary(selected, finalPreview, diff))
  }

  const noSkillChangesAfterRefresh = diff.added.length === 0 && diff.removed.length === 0
  if (noSkillChangesAfterRefresh) {
    command.log(formatSuccess('Source repo checked. Centralized install unchanged.'))
    return
  }

  const proceed = await promptConfirm('Proceed with update?')
  if (!proceed) return

  if (usesLegacyRefreshCompat) {
    await runPublish(
      resolvePath(selected.sourceRepo),
      storedConfig.bundleName ?? selected.name,
      storedConfig.prefix,
      false
    )
  } else {
    await runRefresh(selected.installedRoot, false)
  }
  printLines(command.log.bind(command), formatSyncSummary(selected, finalPreview, diff))

  const verification = await verifyConfigPresence([selected.installedRoot], pathExists)
  command.log(verification.ok ? formatSuccess('Update verified.') : formatWarning(`Missing configs: ${verification.failures.join(', ')}`))
}

async function runAddFlow(command: Command): Promise<void> {
  const centralSkillsRoot = resolvePath(await getConfiguredSkillsRoot())
  const repoMode = await promptSelect('How would you like to choose the source repo?', buildRepoSelectionChoices())
  let repoPath = ''

  if (repoMode === 'configured') {
    let repos: string[] = []
    try {
      repos = await discoverConfiguredRepos()
    } catch (error) {
      if (error instanceof ToolaiConfigError) {
        command.log(formatWarning(error.message))
        return
      }
      throw error
    }
    if (repos.length === 0) {
      command.log(formatWarning('No configured repos were discovered.'))
      return
    }

    repoPath = await promptSelect(
      'What is the source repo path you would like to centralize skills from?',
      repos.map(repo => ({name: repo, value: repo}))
    )
  } else {
    repoPath = resolvePath(await promptInput('Enter the source repo path'))
  }

  const inspection = await inspectRepo(repoPath)
  if (inspection.layout === 'none') {
    command.log(formatWarning('No valid skills were discovered in that repo.'))
    return
  }

  printLines(command.log.bind(command), [
    ...formatInspectionSummary({
      repo: inspection.repoPath,
      layout: inspection.layout,
      rootSkillName: inspection.rootSkill?.name ?? 'none',
      nestedSkillCount: inspection.nestedSkills.length
    })
  ])

  if (inspection.layout === 'mixed-layout') {
    command.log(formatWarning('Mixed-layout publishing is not implemented in the CLI yet. Use the existing centralize-skills workflow for this repo shape today.'))
    return
  }

  const discoveredSkills = inspection.layout === 'root-only'
    ? [inspection.rootSkill].filter(Boolean).map(skill => skill!.name)
    : inspection.nestedSkills.map(skill => skill.name)

  const bundleNeeded = discoveredSkills.length > 1
  let bundleName: string | undefined
  if (bundleNeeded) {
    const defaultBundleName = getDefaultBundleName(repoPath)
    const namingChoice = await promptSelect('How would you like to name the bundle install?', [
      {name: `Use default bundle name: ${defaultBundleName}`, value: 'default'},
      {name: 'Enter a custom bundle name', value: 'custom'}
    ])

    bundleName = namingChoice === 'custom'
      ? (await promptInput('Enter the bundle name', defaultBundleName)).trim()
      : defaultBundleName
  }

  const suggestedPrefix = getDefaultBundleName(repoPath)
  let prefix = await selectPrefix(command, suggestedPrefix)

  while (true) {
    const installRoots = bundleNeeded
      ? [path.join(centralSkillsRoot, bundleName!)]
      : [path.join(centralSkillsRoot, prefix ? `${prefix}-${discoveredSkills[0]}` : discoveredSkills[0])]
    const topLevelAliases = bundleNeeded
      ? discoveredSkills.map(skill => path.join(centralSkillsRoot, prefix ? `${prefix}-${skill}` : skill))
      : []

    const conflicts = await detectConflicts({
      centralRoot: centralSkillsRoot,
      installRoots,
      topLevelAliases,
      pathExists
    })

    if (conflicts.length === 0) {
      printLines(command.log.bind(command), formatPublishPlanSummary({
        repo: repoPath,
        layout: inspection.layout,
        bundle: bundleName ?? 'standalone',
        prefix: prefix ?? '(none)',
        skillCount: discoveredSkills.length
      }))
      break
    }

    printLines(command.log.bind(command), [
      formatWarning('Conflicts detected for the current naming plan.'),
      ...conflicts.map(conflict => `- ${conflict.type}: ${conflict.path}`)
    ])

    const recovery = await promptSelect('How would you like to recover?', [
      {name: 'Change bundle name', value: 'bundle'},
      {name: 'Change prefix', value: 'prefix'},
      {name: 'Choose a different source repo', value: 'repo'},
      {name: 'Cancel', value: 'cancel'}
    ])

    if (recovery === 'bundle' && bundleNeeded) {
      bundleName = (await promptInput('Enter the bundle name', bundleName)).trim()
      continue
    }

    if (recovery === 'prefix') {
      prefix = await selectPrefix(command, suggestedPrefix)
      continue
    }

    if (recovery === 'repo') {
      await runAddFlow(command)
      return
    }

    return
  }

  const proceed = await promptConfirm('Proceed with publish?')
  if (!proceed) return

  const output = await runPublish(repoPath, bundleName, prefix, false)
  const parsedOutput = parsePublishPreview(output)
  const selectedForSummary = {
    kind: bundleNeeded ? 'bundle' as const : 'standalone' as const,
    mode: bundleNeeded ? 'multi-skill-bundle-with-symlinks' as const : 'single-skill-direct-install' as const,
    name: bundleName ?? (prefix ? `${prefix}-${discoveredSkills[0]}` : discoveredSkills[0]),
    prefix: prefix ?? '',
    sourceRepo: repoPath,
    installedRoot: bundleNeeded
      ? path.join(centralSkillsRoot, bundleName!)
      : path.join(centralSkillsRoot, prefix ? `${prefix}-${discoveredSkills[0]}` : discoveredSkills[0])
  }

  if (parsedOutput) {
    printLines(command.log.bind(command), formatPublishSummary(selectedForSummary, parsedOutput))
  } else if (output) {
    command.log(output)
  }

  const verificationRoots = bundleNeeded
    ? [path.join(centralSkillsRoot, bundleName!)]
    : [path.join(centralSkillsRoot, prefix ? `${prefix}-${discoveredSkills[0]}` : discoveredSkills[0])]
  const verification = await verifyConfigPresence(verificationRoots, pathExists)
  command.log(verification.ok ? formatSuccess('Publish verified.') : formatWarning(`Missing configs: ${verification.failures.join(', ')}`))
}

export default class CentralizeSkills extends Command {
  static override description = 'Interactively centralize skills from source repos'

  async run(): Promise<void> {
    try {
      const mode = await promptSelect('What would you like to do?', buildModeChoices())
      if (mode === 'add') {
        await runAddFlow(this)
      } else {
        await runUpdateFlow(this)
      }
    } catch (error) {
      if (error instanceof PromptCancelled) {
        this.log(getCancelMessage())
        return
      }

      throw error
    }
  }
}
