export type SelectableName = string

export type LinkMarker = '[✓]' | '[-]' | '[ ]'

export interface MenuItem {
  index: number
  name: string
  marker: LinkMarker
  detail?: string
}

export type Scope = 'project' | 'global'
export type Operation = 'add' | 'remove'

export interface DiscoveredItem {
  name: string
  marker: LinkMarker
  detail?: string
  kind?: 'item' | 'bundle'
  members?: string[]
}

export interface TargetEntry {
  name: string
  path: string
  marker: LinkMarker
  detail?: string
}

export interface LinkFlowAdapter {
  discoverItems(scope: Scope, operation: Operation): Promise<DiscoveredItem[]>
  discoverTargets(scope: Scope, operation: Operation, selectedItems: string[]): Promise<TargetEntry[]>
  apply(scope: Scope, operation: Operation, selectedItems: string[], selectedTargets: string[]): Promise<string[]>
}
