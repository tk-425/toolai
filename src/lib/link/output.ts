import type {MenuItem, TargetEntry} from './types.js'
import {formatBundleLabel, formatSectionLabel, formatSuccess, formatWarning} from './theme.js'

export function formatMenuItem(item: MenuItem): string {
  const padded = String(item.index).padStart(2, ' ')
  const suffix = item.detail ? `  ${item.detail}` : ''
  const name = item.detail === 'bundle' ? formatBundleLabel(item.name) : item.name
  return `${item.marker} [${padded}]  ${name}${suffix}`
}

export function formatTargetEntry(entry: TargetEntry, index: number): string {
  const padded = String(index).padStart(2, ' ')
  const suffix = entry.detail ? `  ${entry.detail}` : ''
  return `${entry.marker} [${padded}]  ${formatSectionLabel(entry.name)} ${entry.path}${suffix}`
}

export function formatSummaryLine(line: string): string {
  if (line.includes(': created') || line.includes(': removed')) return formatSuccess(line)
  if (line.includes('not found') || line.includes('failed')) return formatWarning(line)
  return line
}
