import {AGENT_TARGETS} from '../config/agent-rules.js'
import {AGENTS_ROOT} from '../config/paths.js'
import {ensureSymlink, removeSymlinkOnly} from '../fs/symlinks.js'
import path from 'node:path'
import {resolvePath, safeReaddir, pathIsSymlink} from '../fs/path-helpers.js'
import {getLinkMarker, targetVisible} from './helpers.js'
import type {DiscoveredItem, Operation, Scope, TargetEntry} from '../link/types.js'

export function toAgentName(filename: string): string {
  return filename.replace(/\.md$/, '')
}

export function toAgentSourcePath(name: string): string {
  return `${AGENTS_ROOT}/${name}.md`
}

async function countLinked(targetPaths: string[], agentName: string): Promise<number> {
  let count = 0
  const candidateFile = `${agentName}.md`
  for (const target of targetPaths) {
    const candidate = path.join(target, candidateFile)
    if (await pathIsSymlink(candidate)) {
      count += 1
    }
  }
  return count
}

async function readAgentNames() {
  const root = resolvePath(AGENTS_ROOT)
  const dirents = await safeReaddir(root)
  const names: string[] = []

  for (const dirent of dirents) {
    if (dirent.name.startsWith('.') || !dirent.name.endsWith('.md')) continue
    names.push(dirent.name.replace(/\.md$/, ''))
  }

  return names
}

export function createAgentsAdapter(log: (line: string) => void) {
  return {
    async discoverItems(scope: Scope, operation: Operation): Promise<DiscoveredItem[]> {
      log(`discover agents ${scope} ${operation}`)
      const targetEntries = AGENT_TARGETS[scope]
      const targetPaths = targetEntries.map(entry => resolvePath(entry.path))
      const totalTargets = targetPaths.length || 1

      const agentNames = await readAgentNames()
      const entries: DiscoveredItem[] = []

      for (const name of agentNames) {
        const linkedCount = await countLinked(targetPaths, name)
        if (operation === 'remove' && linkedCount === 0) continue
        entries.push({
          name,
          marker: getLinkMarker(linkedCount, totalTargets)
        })
      }

      entries.sort((a, b) => a.name.localeCompare(b.name))
      return entries
    },

    async discoverTargets(scope: Scope, operation: Operation, selectedItems: string[]): Promise<TargetEntry[]> {
      log(`discover agent targets ${scope} ${operation}`)
      const entries = AGENT_TARGETS[scope].map(entry => ({
        name: entry.label,
        path: entry.path,
        resolved: resolvePath(entry.path)
      }))

      const result: TargetEntry[] = []
      for (const entry of entries) {
        const linkedCount = selectedItems.length
          ? (await Promise.all(selectedItems.map(item => pathIsSymlink(path.join(entry.resolved, `${item}.md`)))))
              .filter(Boolean).length
          : 0
        if (!targetVisible(operation, linkedCount)) continue
        result.push({
          name: entry.name,
          path: entry.path,
          marker: getLinkMarker(linkedCount, selectedItems.length || 1),
          detail: selectedItems.length ? `linked ${linkedCount}/${selectedItems.length}` : undefined
        })
      }

      return result
    },

    async apply(scope: Scope, operation: Operation, selectedItems: string[], selectedTargets: string[]): Promise<string[]> {
      log(`apply agent changes ${scope} ${operation}`)
      const targetsByName = new Map<string, string>(AGENT_TARGETS[scope].map(entry => [entry.label, entry.path]))
      const lines: string[] = []
      for (const targetName of selectedTargets) {
        const relativePath = targetsByName.get(targetName)
        if (!relativePath) continue
        const resolvedTarget = resolvePath(relativePath)
        for (const item of selectedItems) {
          const linkTarget = path.join(resolvedTarget, `${item}.md`)
          const source = path.join(resolvePath(AGENTS_ROOT), `${item}.md`)
          if (operation === 'add') {
            try {
              const result = await ensureSymlink(source, linkTarget)
              lines.push(`[${targetName}] ${item}: ${result}`)
            } catch (error) {
              lines.push(
                `[${targetName}] ${item}: ${'message' in (error as Error) ? (error as Error).message : 'failed'}`
              )
            }
          } else {
            const removed = await removeSymlinkOnly(linkTarget)
            lines.push(`[${targetName}] ${item}: ${removed ? 'removed' : 'not found or not a symlink'}`)
          }
        }
      }

      return lines
    }
  }
}
