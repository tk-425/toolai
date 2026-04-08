import type {TargetEntry} from './types.js'
import {formatFieldLabel, formatFieldValue, formatPathValue, formatSuccess, formatWarning} from './theme.js'

export function formatTargetEntry(entry: TargetEntry, index: number): string {
  const padded = String(index).padStart(2, ' ')
  const suffix = entry.detail ? `  ${entry.detail}` : ''
  return `${entry.marker} [${padded}]  ${formatFieldValue(entry.name)} ${formatPathValue(entry.path)}${suffix}`
}

export function formatSummaryLine(line: string): string {
  const match = /^\[(.+?)\]\s+(.+?):\s+(.+)$/.exec(line)
  if (match) {
    const [, target, item, status] = match
    const formatted = `${formatFieldLabel('Target')} ${formatFieldValue(target)}  ${formatFieldLabel('Item')} ${formatFieldValue(item)}  ${status}`
    if (status.includes('created') || status.includes('removed')) return formatSuccess(formatted)
    if (status.includes('not found') || status.includes('failed')) return formatWarning(formatted)
    return formatted
  }

  if (line.includes(': created') || line.includes(': removed')) return formatSuccess(line)
  if (line.includes('not found') || line.includes('failed')) return formatWarning(line)
  return line
}
