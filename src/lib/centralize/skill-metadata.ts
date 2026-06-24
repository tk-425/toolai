import {readFile, stat} from 'node:fs/promises'
import {basename, join} from 'node:path'
import type {DiscoveredSkill} from './types.js'

function parseFrontmatterName(contents: string): string | null {
  const lines = contents.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return null

  for (let index = 1; index < lines.length; index++) {
    const line = lines[index]
    const trimmed = line.trim()

    if (trimmed === '---') break

    const match = line.match(/^\s*name\s*:\s*(.+?)\s*$/)
    if (!match) continue

    const rawValue = match[1].trim()
    if (!rawValue) return null

    return rawValue.replace(/^['"]|['"]$/g, '').trim() || null
  }

  return null
}

async function hasSkillFile(dir: string): Promise<boolean> {
  try {
    const info = await stat(join(dir, 'SKILL.md'))
    return info.isFile()
  } catch {
    return false
  }
}

export async function readSkillMetadata(dir: string, isRoot: boolean): Promise<DiscoveredSkill | null> {
  if (!(await hasSkillFile(dir))) return null

  const directoryName = basename(dir)
  const contents = await readFile(join(dir, 'SKILL.md'), 'utf8')
  const frontmatterName = parseFrontmatterName(contents)

  return {
    name: frontmatterName ?? directoryName,
    path: dir,
    isRoot
  }
}
