import {formatFieldLabel, formatFieldValue, formatPathValue, formatSectionLabel} from '../link/theme.js'
import type {CentralizedInstall, SkillDiff} from './types.js'
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
