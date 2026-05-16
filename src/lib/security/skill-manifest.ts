import {mkdir, readFile, readdir, rename, writeFile} from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'

export interface SkillManifestEntry {
  name: string
  hash: string
  status: 'pending' | 'clean' | 'flagged'
  updatedAt: string
  scannedAt: string | null
  path?: string
}

export interface SkillManifestData {
  last_updated: string
  skills: Record<string, SkillManifestEntry>
}

export class SkillManifest {
  private manifestPath: string

  constructor(manifestPath: string) {
    this.manifestPath = manifestPath
  }

  async read(): Promise<SkillManifestData> {
    try {
      const contents = await readFile(this.manifestPath, 'utf8')
      return JSON.parse(contents) as SkillManifestData
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {last_updated: '', skills: {}}
      }
      throw error
    }
  }

  async write(manifest: SkillManifestData): Promise<void> {
    const dir = path.dirname(this.manifestPath)
    await mkdir(dir, {recursive: true})
    const tmpPath = `${this.manifestPath}.tmp-${process.pid}-${Date.now()}`
    await writeFile(tmpPath, JSON.stringify(manifest, null, 2), 'utf8')
    await rename(tmpPath, this.manifestPath)
  }

  async addOrUpdateSkill(name: string, hash: string, updatedAt: string, skillPath?: string): Promise<void> {
    const manifest = await this.read()
    manifest.skills[name] = {
      name,
      hash,
      status: 'pending',
      updatedAt,
      scannedAt: null,
      ...(skillPath && {path: skillPath})
    }
    manifest.last_updated = new Date().toISOString()
    await this.write(manifest)
  }

  async removeSkill(name: string): Promise<void> {
    const manifest = await this.read()
    delete manifest.skills[name]
    manifest.last_updated = new Date().toISOString()
    await this.write(manifest)
  }

  async computeHash(skillDir: string): Promise<string> {
    const hash = createHash('sha256')
    const files = await this.walkDir(skillDir)
    for (const file of files) {
      const content = await readFile(file)
      hash.update(content)
    }
    return hash.digest('hex')
  }

  private async walkDir(dir: string): Promise<string[]> {
    const entries = await readdir(dir, {withFileTypes: true})
    const files: string[] = []
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...await this.walkDir(fullPath))
      } else if (entry.isFile()) {
        files.push(fullPath)
      }
    }
    return files.sort()
  }
}

export function getSkillManifestPath(): string {
  return path.join(os.homedir(), '.toolai', 'skill-scan.json')
}

export function getSkillRoot(): string {
  return path.join(os.homedir(), '.agent-tools', 'skills')
}