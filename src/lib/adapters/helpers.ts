import type {LinkMarker, Operation} from '../link/types.js'

export function getLinkMarker(linkedCount: number, total: number): LinkMarker {
  if (total === 0 || linkedCount === 0) return '[ ]'
  if (linkedCount === total) return '[✓]'
  return '[-]'
}

export function targetVisible(operation: Operation, linkedCount: number): boolean {
  if (operation === 'add') return true
  return linkedCount > 0
}
