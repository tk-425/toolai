import {formatFieldLabel, formatFieldValue, formatPathValue, formatSectionLabel} from '../link/theme.js'
import type {CentralizedInstall, RemovalPlan, RemovalSummary, SkillDiff} from './types.js'
import type {PublishPreview} from './scripts.js'

export function diffSkills(previousSkills: string[] = [], nextSkills: string[] = []): SkillDiff {
  return {
    added: nextSkills.filter(skill => !previousSkills.includes(skill)),
    removed: previousSkills.filter(skill => !nextSkills.includes(skill))
  }
}

function formatListSection(label: string, values: string[]): string[] {
  if (values.length === 0) return []
  return [formatFieldLabel(label.replace(/:$/, '')), ...values.map(value => `- ${value}`)]
}

function getContentChangedSkills(preview: PublishPreview, diff: SkillDiff): string[] {
  return (preview.contentChangedSkills ?? []).filter(skill => !diff.added.includes(skill) && !diff.removed.includes(skill))
}

function formatRow(label: string, value: string, kind: 'default' | 'path' = 'default'): string {
  const formattedValue = kind === 'path' ? formatPathValue(value) : formatFieldValue(value)
  return `${formatFieldLabel(label)} ${formattedValue}`
}

export function formatInspectionSummary(input: {
  repo: string
  layout: string
  rootSkillName?: string | null
  nestedSkillCount: number
}): string[] {
  return [
    formatSectionLabel('Inspection'),
    formatRow('Repo', input.repo, 'path'),
    formatRow('Layout', input.layout),
    formatRow('Root', input.rootSkillName ?? 'none'),
    formatRow('Skills', String(input.nestedSkillCount))
  ]
}

export function formatPublishPlanSummary(input: {
  repo: string
  layout: string
  bundle?: string
  prefix?: string
  skillCount: number
}): string[] {
  return [
    formatSectionLabel('Publish plan'),
    formatRow('Repo', input.repo, 'path'),
    formatRow('Layout', input.layout),
    formatRow('Bundle', input.bundle ?? 'standalone'),
    formatRow('Prefix', input.prefix ?? '(none)'),
    formatRow('Skills', String(input.skillCount))
  ]
}

export function formatPreviewSummary(selected: CentralizedInstall, preview: PublishPreview, diff: SkillDiff): string[] {
  const contentChangedSkills = getContentChangedSkills(preview, diff)
  const lines = [
    formatSectionLabel('Preview'),
    formatRow('Install', selected.name),
    formatRow('Type', selected.kind),
    formatRow('Prefix', preview.prefix || '(none)'),
    formatRow('Source', selected.sourceRepo, 'path'),
    formatRow('Target', preview.publishedTo, 'path'),
    formatRow('Skills', String(preview.installedSkills.length))
  ]

  if (selected.kind === 'bundle') lines.push(formatRow('Symlinks', String(preview.installedSkills.length)))
  if (diff.added.length === 0 && diff.removed.length === 0 && contentChangedSkills.length === 0) {
    lines.push(formatFieldValue('No skill changes detected.'))
    return lines
  }

  return [
    ...lines,
    ...formatListSection('Added skills:', diff.added),
    ...formatListSection('Removed skills:', diff.removed),
    ...formatListSection('Updated skills:', contentChangedSkills)
  ]
}

export function formatSyncSummary(selected: CentralizedInstall, preview: PublishPreview, diff: SkillDiff): string[] {
  const contentChangedSkills = getContentChangedSkills(preview, diff)
  return [
    formatSectionLabel('Sync complete'),
    formatRow('Install', selected.name),
    formatRow('Type', selected.kind),
    formatRow('Target', preview.publishedTo, 'path'),
    formatRow('Skills', String(preview.installedSkills.length)),
    ...(selected.kind === 'bundle' ? [formatRow('Symlinks', String(preview.installedSkills.length))] : []),
    ...formatListSection('Added skills:', diff.added),
    ...formatListSection('Removed skills:', diff.removed),
    ...formatListSection('Updated skills:', contentChangedSkills)
  ]
}

export function formatPublishSummary(selected: CentralizedInstall, preview: PublishPreview): string[] {
  return [
    formatSectionLabel('Publish complete'),
    formatRow('Install', selected.name),
    formatRow('Type', selected.kind),
    formatRow('Prefix', preview.prefix || '(none)'),
    formatRow('Source', selected.sourceRepo, 'path'),
    formatRow('Target', preview.publishedTo, 'path'),
    formatRow('Skills', String(preview.installedSkills.length)),
    ...(selected.kind === 'bundle' ? [formatRow('Symlinks', String(preview.installedSkills.length))] : [])
  ]
}

export function formatRemovalPreview(plan: RemovalPlan): string[] {
  const lines = [
    formatSectionLabel('Removal preview'),
    formatRow('Target', plan.target.name),
    formatRow('Type', plan.target.kind),
    ...formatListSection('Paths to delete:', plan.paths.map(formatPathValue)),
    ...formatListSection('Manifest entries:', plan.manifestEntries)
  ]

  if (plan.configRewrite) {
    lines.push(formatRow('Config', plan.configRewrite.configPath, 'path'))
    const remaining = plan.configRewrite.installedSkills
    lines.push(...formatListSection('Remaining skills:', remaining.length > 0 ? remaining : ['(none)']))
  }

  if (plan.removesBundle) {
    lines.push(formatFieldValue('Removing the last Skill also removes the now-empty bundle.'))
  }

  return lines
}

export function formatRemovalSummary(summary: RemovalSummary): string[] {
  const lines = [
    formatSectionLabel('Removal complete'),
    formatRow('Target', summary.target.name),
    formatRow('Type', summary.target.kind),
    ...formatListSection('Removed paths:', summary.removedPaths.map(formatPathValue)),
    ...formatListSection('Manifest entries removed:', summary.removedManifestEntries),
    ...formatListSection('Skipped paths:', summary.skippedPaths.map(formatPathValue))
  ]

  if (summary.message) {
    lines.push(formatFieldValue(summary.message))
  }

  return lines
}
