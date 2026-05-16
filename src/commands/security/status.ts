import {Command} from '@oclif/core'
import {readdir} from 'node:fs/promises'
import pc from 'picocolors'
import {resolvePath} from '../../lib/fs/path-helpers.js'
import {getConfiguredSkillsRoot} from '../../lib/config/toolai-config.js'
import {SkillManifest, getSkillManifestPath} from '../../lib/security/index.js'
import {getSkillRoot} from '../../lib/security/skill-manifest.js'

export default class SecurityStatus extends Command {
  static override description = 'Show skills with pending or flagged scan status'

  async run(): Promise<void> {
    const manifestPath = resolvePath(getSkillManifestPath())
    const manifest = new SkillManifest(manifestPath)
    let data = await manifest.read()

    if (Object.keys(data.skills).length === 0) {
      data = await this.bootstrapManifest(manifest)
    } else {
      data = await this.backfillPaths(manifest)
    }

    const entries = Object.values(data.skills).filter(
      entry => entry.status === 'pending' || entry.status === 'flagged'
    )

    if (entries.length === 0) {
      this.log('All skills are clean.')
      return
    }

    const pending = entries.filter(e => e.status === 'pending')
    const flagged = entries.filter(e => e.status === 'flagged')

    for (const entry of entries) {
      const badge = entry.status === 'flagged'
        ? pc.red('[flagged]')
        : pc.yellow('[pending]')
      const pathSuffix = entry.path ? ` (${entry.path})` : ''
      this.log(`${badge} ${pc.bold(entry.name)} — last updated ${entry.updatedAt}${pathSuffix}`)
    }

    this.log(`\n${pc.yellow(`${pending.length} pending`)}, ${pc.red(`${flagged.length} flagged`)}`)
  }

  private async bootstrapManifest(manifest: SkillManifest): Promise<ReturnType<typeof manifest.read>> {
    this.log('Manifest not found. Bootstrapping from configured skills root...')
    const skillsRoot = resolvePath(getSkillRoot())
    const manifestData = await manifest.read()

    try {
      const entries = await readdir(skillsRoot, {withFileTypes: true})
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const skillPath = resolvePath(`${skillsRoot}/${entry.name}`)
        const hash = await manifest.computeHash(skillPath)
        await manifest.addOrUpdateSkill(entry.name, hash, new Date().toISOString(), skillPath)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }

    return manifest.read()
  }

  private async backfillPaths(manifest: SkillManifest): Promise<ReturnType<typeof manifest.read>> {
    const skillRoot = resolvePath(getSkillRoot())
    const manifestData = await manifest.read()
    let changed = false

    for (const skillName of Object.keys(manifestData.skills)) {
      if (!manifestData.skills[skillName].path) {
        manifestData.skills[skillName].path = `${skillRoot}/${skillName}`
        changed = true
      }
    }

    if (changed) {
      manifestData.last_updated = new Date().toISOString()
      await manifest.write(manifestData)
    }

    return manifestData
  }
}