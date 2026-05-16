import {cp, lstat, mkdir, readFile, readdir, readlink, rename, rm, symlink, writeFile} from 'node:fs/promises'
import path, {basename, join, relative} from 'node:path'
import {getConfiguredSkillsRoot} from '../config/toolai-config.js'
import {resolvePath} from '../fs/path-helpers.js'
import {SkillManifest, getSkillManifestPath} from '../security/index.js'
import type {CentralizedInstall} from './types.js'
import {discoverSkillDirs} from './discovery.js'
import {directoriesDiffer} from './verify.js'

export interface PublishPreview {
  mode: 'multi-skill-bundle-with-symlinks' | 'single-skill-direct-install'
  dryRun: boolean
  bundleName: string
  prefix: string
  discoveredSkills: string[]
  installedSkills: string[]
  contentChangedSkills: string[]
  publishedTo: string
}

interface EngineOptions {
  centralRoot?: string
}

interface PublishRuntimeOptions extends EngineOptions {
  modeHint?: PublishPreview['mode']
}

interface StoredInstallConfig {
  version?: number
  mode?: PublishPreview['mode']
  installType?: PublishPreview['mode']
  sourceRepo: string
  bundleName: string
  prefix: string
  discoveredSkills?: string[]
  installedSkills?: string[]
}

async function getCentralRoot(options?: EngineOptions): Promise<string> {
  return resolvePath(options?.centralRoot ?? await getConfiguredSkillsRoot())
}

function normalizePrefix(prefix?: string): string {
  if (!prefix) return ''
  return prefix.endsWith('-') ? prefix : `${prefix}-`
}

function prefixedName(prefix: string, name: string): string {
  if (!prefix) return name
  return name.startsWith(prefix) ? name : `${prefix}${name}`
}

let _manifest: SkillManifest | null = null

function getManifest(): SkillManifest {
  if (!_manifest) {
    _manifest = new SkillManifest(resolvePath(getSkillManifestPath()))
  }
  return _manifest
}

async function pathInfo(candidate: string) {
  try {
    return await lstat(candidate)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function copyDirAtomic(src: string, dest: string): Promise<void> {
  const destDir = path.dirname(dest)
  const stage = join(destDir, `.tmp-${basename(dest)}-${process.pid}-${Date.now()}`)
  await mkdir(destDir, {recursive: true})
  await rm(stage, {recursive: true, force: true})
  await cp(src, stage, {recursive: true})
  await rm(dest, {recursive: true, force: true})
  await rename(stage, dest)
}

async function rewriteFrontmatterName(skillMdPath: string, newName: string): Promise<void> {
  const contents = await readFile(skillMdPath, 'utf8')
  const lines = contents.split('\n')
  let inFrontmatter = false
  let replaced = false
  const nextLines = lines.map(line => {
    if (line === '---') {
      inFrontmatter = !inFrontmatter
      return line
    }
    if (inFrontmatter && line.startsWith('name:')) {
      replaced = true
      return `name: ${newName}`
    }
    return line
  })

  if (replaced) {
    await writeFile(skillMdPath, nextLines.join('\n'), 'utf8')
  }
}

function buildConfigPayload(input: {
  mode: PublishPreview['mode']
  sourceRepo: string
  bundleName: string
  prefix: string
  discoveredSkills: string[]
  installedSkills: string[]
}): StoredInstallConfig & {publishedAt: string} {
  return {
    version: 1,
    mode: input.mode,
    sourceRepo: input.sourceRepo,
    bundleName: input.bundleName,
    prefix: input.prefix,
    publishedAt: new Date().toISOString(),
    discoveredSkills: input.discoveredSkills,
    installedSkills: input.installedSkills
  }
}

async function writeInstallConfig(configPath: string, payload: ReturnType<typeof buildConfigPayload>) {
  await mkdir(path.dirname(configPath), {recursive: true})
  await writeFile(configPath, JSON.stringify(payload, null, 2), 'utf8')
}

async function readStoredInstallConfig(installRoot: string): Promise<StoredInstallConfig> {
  const contents = await readFile(join(installRoot, '.centralize-config.json'), 'utf8')
  return JSON.parse(contents) as StoredInstallConfig
}

async function removeOwnedBundleAliases(input: {
  centralRoot: string
  bundleDir: string
  bundleName: string
  previousInstalledSkills: string[]
  nextInstalledSkills: string[]
}) {
  const removed = input.previousInstalledSkills.filter(skill => !input.nextInstalledSkills.includes(skill))

  for (const installedName of removed) {
    await rm(join(input.bundleDir, installedName), {recursive: true, force: true})

    const aliasPath = join(input.centralRoot, installedName)
    const info = await pathInfo(aliasPath)
    if (!info?.isSymbolicLink()) {
      await getManifest().removeSkill(installedName)
      continue
    }

    const linkTarget = await readlink(aliasPath)
    const isOwnedAlias = linkTarget === `${input.bundleName}/${installedName}`
    if (isOwnedAlias) {
      await rm(aliasPath, {force: true})
    }
    await getManifest().removeSkill(installedName)
  }
}

export async function listCentralizedInstalls(options?: EngineOptions): Promise<CentralizedInstall[]> {
  const centralRoot = await getCentralRoot(options)
  const entries = await readdir(centralRoot, {withFileTypes: true}).catch(() => [])
  const installs: CentralizedInstall[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const installRoot = join(centralRoot, entry.name)
    const configPath = join(installRoot, '.centralize-config.json')
    const info = await pathInfo(configPath)
    if (!info?.isFile()) continue

    const parsed = await readStoredInstallConfig(installRoot)
    const mode = parsed.mode ?? parsed.installType
    if (!mode) continue

    installs.push({
      kind: mode === 'multi-skill-bundle-with-symlinks' ? 'bundle' : 'standalone',
      mode,
      name: basename(installRoot),
      prefix: parsed.prefix ?? '',
      sourceRepo: parsed.sourceRepo,
      installedRoot: installRoot
    })
  }

  return installs.sort((a, b) => a.name.localeCompare(b.name))
}

export async function publishSkills(
  sourceRepo: string,
  bundleName?: string,
  prefix?: string,
  dryRun = false,
  options?: PublishRuntimeOptions
): Promise<PublishPreview> {
  const resolvedRepo = resolvePath(sourceRepo)
  const centralRoot = await getCentralRoot(options)
  const normalizedPrefix = normalizePrefix(prefix)
  const discoveredDirs = await discoverSkillDirs(resolvedRepo)
  const discoveredSkills = discoveredDirs.map(dir => basename(dir))
  const installedSkills = discoveredSkills.map(skill => prefixedName(normalizedPrefix, skill))
  const resolvedBundleName = bundleName || basename(resolvedRepo)

  const shouldUseSingleSkillMode = discoveredSkills.length === 1 && options?.modeHint !== 'multi-skill-bundle-with-symlinks'

  if (shouldUseSingleSkillMode) {
    const targetDir = join(centralRoot, installedSkills[0])
    const targetInfo = await pathInfo(targetDir)
    if (targetInfo?.isSymbolicLink()) throw new Error(`conflicting target paths exist: ${targetDir}`)
    if (targetInfo && !targetInfo.isDirectory()) throw new Error(`conflicting target paths exist: ${targetDir}`)
    const contentChangedSkills = await directoriesDiffer(discoveredDirs[0], targetDir) ? [installedSkills[0]] : []

    if (!dryRun) {
      await copyDirAtomic(discoveredDirs[0], targetDir)
      if (normalizedPrefix) await rewriteFrontmatterName(join(targetDir, 'SKILL.md'), installedSkills[0])
      await writeInstallConfig(join(targetDir, '.centralize-config.json'), buildConfigPayload({
        mode: 'single-skill-direct-install',
        sourceRepo: resolvedRepo,
        bundleName: resolvedBundleName,
        prefix: normalizedPrefix,
        discoveredSkills,
        installedSkills
      }))
      const manifest = getManifest()
      for (const installedName of installedSkills) {
        const skillPath = targetDir
        const hash = await manifest.computeHash(skillPath)
        await manifest.addOrUpdateSkill(installedName, hash, new Date().toISOString(), skillPath)
      }
    }

    return {
      mode: 'single-skill-direct-install',
      dryRun,
      bundleName: resolvedBundleName,
      prefix: normalizedPrefix,
      discoveredSkills,
      installedSkills,
      contentChangedSkills,
      publishedTo: targetDir
    }
  }

  const bundleDir = join(centralRoot, resolvedBundleName)
  const previousConfig = await pathInfo(join(bundleDir, '.centralize-config.json'))
    ? await readStoredInstallConfig(bundleDir)
    : undefined

  for (const installedName of installedSkills) {
    const aliasPath = join(centralRoot, installedName)
    const info = await pathInfo(aliasPath)
    if (info && !info.isSymbolicLink()) throw new Error(`conflicting target paths exist: ${aliasPath}`)
  }

  const changedFlags = await Promise.all(
    discoveredDirs.map(async (discoveredDir, index) =>
      directoriesDiffer(discoveredDir, join(bundleDir, installedSkills[index]))
    )
  )
  const contentChangedSkills = installedSkills.filter((_, index) => changedFlags[index])

  if (!dryRun) {
    if (previousConfig?.installedSkills) {
      await removeOwnedBundleAliases({
        centralRoot,
        bundleDir,
        bundleName: resolvedBundleName,
        previousInstalledSkills: previousConfig.installedSkills,
        nextInstalledSkills: []
      })
    }
    await rm(bundleDir, {recursive: true, force: true})
    await mkdir(bundleDir, {recursive: true})
  }

  for (let index = 0; index < discoveredDirs.length; index++) {
    const discoveredDir = discoveredDirs[index]
    const installedName = installedSkills[index]
    const bundledTarget = join(bundleDir, installedName)
    const aliasPath = join(centralRoot, installedName)
    const relTarget = `${resolvedBundleName}/${installedName}`

    if (!dryRun) {
      await copyDirAtomic(discoveredDir, bundledTarget)
      if (normalizedPrefix) await rewriteFrontmatterName(join(bundledTarget, 'SKILL.md'), installedName)
      await rm(aliasPath, {force: true})
      await symlink(relTarget, aliasPath)
    }
  }

  if (!dryRun) {
    await writeInstallConfig(join(bundleDir, '.centralize-config.json'), buildConfigPayload({
      mode: 'multi-skill-bundle-with-symlinks',
      sourceRepo: resolvedRepo,
      bundleName: resolvedBundleName,
      prefix: normalizedPrefix,
      discoveredSkills,
      installedSkills
    }))
    const manifest = getManifest()
    for (const installedName of installedSkills) {
      const hash = await manifest.computeHash(join(bundleDir, installedName))
      await manifest.addOrUpdateSkill(installedName, hash, new Date().toISOString())
    }
  }

  return {
    mode: 'multi-skill-bundle-with-symlinks',
    dryRun,
    bundleName: resolvedBundleName,
    prefix: normalizedPrefix,
    discoveredSkills,
    installedSkills,
    contentChangedSkills,
    publishedTo: bundleDir
  }
}

export async function refreshSkills(installedRoot: string, dryRun = false, options?: EngineOptions): Promise<PublishPreview> {
  const resolvedInstallRoot = resolvePath(installedRoot)
  const config = await readStoredInstallConfig(resolvedInstallRoot)
  const mode = config.mode ?? config.installType
  if (!mode) throw new Error(`centralized config is missing mode/installType: ${join(resolvedInstallRoot, '.centralize-config.json')}`)

  return publishSkills(
    config.sourceRepo,
    config.bundleName,
    config.prefix,
    dryRun,
    {
      ...options,
      modeHint: mode
    }
  )
}
