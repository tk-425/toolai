import {SKILL_TARGETS, GLOBAL_SKILLS} from '../config/skill-rules.js'
import {SKILLS_ROOT} from '../config/paths.js'
import {ensureSymlink, removeSymlinkOnly} from '../fs/symlinks.js'
import path from 'node:path'
import os from 'node:os'
import {lstat, readdir, readlink} from 'node:fs/promises'
import {getLinkMarker, targetVisible} from './helpers.js'
import type {DiscoveredItem, Operation, Scope, TargetEntry} from '../link/types.js'

export function isGlobalSkill(name: string): boolean {
  return GLOBAL_SKILLS.has(name)
}

function resolvePath(p: string): string {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1))
  }
  return path.resolve(p)
}

async function safeReaddir(dir: string) {
  try {
    return await readdir(dir, {withFileTypes: true})
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function readChildDirectories(dir: string): Promise<string[]> {
  const dirents = await safeReaddir(dir)
  return dirents
    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
    .map(dirent => dirent.name)
    .sort()
}

async function pathIsSymlink(candidate: string): Promise<boolean> {
  try {
    const stat = await lstat(candidate)
    return stat.isSymbolicLink()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function countLinked(targetPaths: string[], entry: string): Promise<number> {
  let count = 0
  for (const target of targetPaths) {
    const candidate = path.join(target, entry)
    if (await pathIsSymlink(candidate)) {
      count += 1
    }
  }
  return count
}

async function countLinkedMembers(targetPaths: string[], members: string[]): Promise<number> {
  let count = 0
  for (const member of members) {
    count += await countLinked(targetPaths, member)
  }
  return count
}

async function readSkillNames() {
  const root = resolvePath(SKILLS_ROOT)
  const dirents = await safeReaddir(root)
  const aliases = new Map<string, string>()
  const standalones = new Set<string>()

  for (const dirent of dirents) {
    if (dirent.name.startsWith('.')) continue
    const entryPath = path.join(root, dirent.name)
    const stat = await lstat(entryPath)
    if (stat.isSymbolicLink()) {
      const target = await readlink(entryPath)
      aliases.set(dirent.name, target)
    } else if (stat.isDirectory()) {
      standalones.add(dirent.name)
    }
  }

  return {aliases, standalones}
}

export function detectBundles(aliases: Map<string, string>): Map<string, string[]> {
  const bundles = new Map<string, string[]>()

  for (const [alias, target] of aliases.entries()) {
    const slash = target.indexOf('/')
    if (slash === -1) continue
    const bundle = target.slice(0, slash)
    if (bundle.startsWith('.') || GLOBAL_SKILLS.has(bundle)) continue

    const members = bundles.get(bundle) ?? []
    members.push(alias)
    bundles.set(bundle, members)
  }

  return bundles
}

export function buildBundleEntries(
  bundleMembership: Map<string, string[]>,
  linkedCounts: Map<string, number>,
  totalTargets: number,
  operation: Operation
): DiscoveredItem[] {
  const entries: DiscoveredItem[] = []

  for (const [bundleName, members] of bundleMembership.entries()) {
    const linkedCount = members.reduce((sum, member) => sum + (linkedCounts.get(member) ?? 0), 0)
    const maxLinkedCount = totalTargets * members.length || 1
    if (operation === 'remove' && linkedCount === 0) continue
    if (operation === 'add' && linkedCount === maxLinkedCount) continue

    entries.push({
      name: bundleName,
      marker: getLinkMarker(linkedCount, maxLinkedCount),
      detail: 'bundle',
      kind: 'bundle',
      members: [...members]
    })
  }

  return entries
}

export function shouldHideStandaloneBundleSource(
  standalone: string,
  bundleNames: Set<string>,
  bundleMembership: Map<string, string[]>,
  childDirectories: string[]
): boolean {
  if (bundleNames.has(standalone)) return true

  const childSet = new Set(childDirectories)
  for (const members of bundleMembership.values()) {
    if (members.length === 0) continue
    if (members.length !== childDirectories.length) continue
    if (members.every(member => childSet.has(member))) return true
  }

  return false
}

export function createSkillsAdapter(log: (line: string) => void) {
  return {
    async discoverItems(scope: Scope, operation: Operation): Promise<DiscoveredItem[]> {
      log(`discover skills ${scope} ${operation}`)
      const targetEntries = SKILL_TARGETS[scope]
      const targetPaths = targetEntries.map(entry => resolvePath(entry.path))
      const totalTargets = targetPaths.length || 1

      const {aliases, standalones} = await readSkillNames()
      const bundleMembership = detectBundles(aliases)
      const bundleNames = new Set(bundleMembership.keys())
      const bundledMembers = new Set(Array.from(bundleMembership.values()).flat())

      const entries: DiscoveredItem[] = []
      const linkedCounts = new Map<string, number>()

      for (const alias of aliases.keys()) {
        if (GLOBAL_SKILLS.has(alias)) continue
        if (alias === 'gstack') continue
        const linkedCount = await countLinked(targetPaths, alias)
        linkedCounts.set(alias, linkedCount)
      }

      entries.push(...buildBundleEntries(bundleMembership, linkedCounts, totalTargets, operation))

      for (const alias of aliases.keys()) {
        if (GLOBAL_SKILLS.has(alias)) continue
        if (alias === 'gstack') continue
        if (bundledMembers.has(alias)) continue
        const linkedCount = linkedCounts.get(alias) ?? 0
        if (operation === 'remove' && linkedCount === 0) continue
        if (operation === 'add' && linkedCount === totalTargets) continue
        entries.push({
          name: alias,
          marker: getLinkMarker(linkedCount, totalTargets),
          kind: 'item'
        })
      }

      for (const standalone of standalones) {
        if (GLOBAL_SKILLS.has(standalone)) continue
        const childDirectories = await readChildDirectories(path.join(resolvePath(SKILLS_ROOT), standalone))
        if (shouldHideStandaloneBundleSource(standalone, bundleNames, bundleMembership, childDirectories)) continue
        const linkedCount = await countLinked(targetPaths, standalone)
        if (operation === 'remove' && linkedCount === 0) continue
        if (operation === 'add' && linkedCount === totalTargets) continue
        entries.push({
          name: standalone,
          marker: getLinkMarker(linkedCount, totalTargets),
          kind: 'item'
        })
      }

      entries.sort((a, b) => {
        if (a.kind === 'bundle' && b.kind !== 'bundle') return -1
        if (a.kind !== 'bundle' && b.kind === 'bundle') return 1
        return a.name.localeCompare(b.name)
      })

      return entries
    },

    async discoverTargets(scope: Scope, operation: Operation, selectedItems: string[]): Promise<TargetEntry[]> {
      log(`discover skill targets ${scope} ${operation}`)
      const {aliases} = await readSkillNames()
      const bundleMembership = detectBundles(aliases)
      const entries = SKILL_TARGETS[scope].map(entry => ({
        name: entry.label,
        path: entry.path,
        resolved: resolvePath(entry.path)
      }))

      const result: TargetEntry[] = []
      for (const entry of entries) {
        const linkedCount = selectedItems.length
          ? (await Promise.all(selectedItems.flatMap(item => {
              const members = bundleMembership.get(item) ?? [item]
              return members.map(member => pathIsSymlink(path.join(entry.resolved, member)))
            })))
              .filter(Boolean).length
          : 0
        if (!targetVisible(operation, linkedCount)) continue
        const totalItems = selectedItems.reduce((sum, item) => sum + (bundleMembership.get(item)?.length ?? 1), 0) || 1
        result.push({
          name: entry.name,
          path: entry.path,
          marker: getLinkMarker(linkedCount, totalItems),
          detail: selectedItems.length ? `linked ${linkedCount}/${totalItems}` : undefined
        })
      }

      return result
    },

    async apply(scope: Scope, operation: Operation, selectedItems: string[], selectedTargets: string[]): Promise<string[]> {
      log(`apply skill changes ${scope} ${operation}`)
      const {aliases} = await readSkillNames()
      const bundleMembership = detectBundles(aliases)
      const targetsByName = new Map<string, string>(SKILL_TARGETS[scope].map(entry => [entry.label, entry.path]))
      const lines: string[] = []
      for (const targetName of selectedTargets) {
        const relativePath = targetsByName.get(targetName)
        if (!relativePath) continue
        const resolvedTarget = resolvePath(relativePath)
        for (const item of selectedItems) {
          const members = bundleMembership.get(item) ?? [item]
          for (const member of members) {
            const linkTarget = path.join(resolvedTarget, member)
            const source = path.join(resolvePath(SKILLS_ROOT), member)
            if (operation === 'add') {
              try {
                const result = await ensureSymlink(source, linkTarget)
                lines.push(`[${targetName}] ${member}: ${result}`)
              } catch (error) {
                lines.push(
                  `[${targetName}] ${member}: ${'message' in (error as Error) ? (error as Error).message : 'failed'}`
                )
              }
            } else {
              const removed = await removeSymlinkOnly(linkTarget)
              lines.push(`[${targetName}] ${member}: ${removed ? 'removed' : 'not found or not a symlink'}`)
            }
          }
        }
      }

      return lines
    }
  }
}
