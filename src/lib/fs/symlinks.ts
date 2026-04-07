import {lstat, mkdir, rm, symlink} from 'node:fs/promises'
import path from 'node:path'

export async function ensureSymlink(source: string, target: string): Promise<'created' | 'skipped'> {
  try {
    const stat = await lstat(target)
    if (stat.isSymbolicLink()) return 'skipped'
    throw new Error(`Refusing to overwrite non-symlink: ${target}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  await mkdir(path.dirname(target), {recursive: true})
  await symlink(source, target)
  return 'created'
}

export async function removeSymlinkOnly(target: string): Promise<boolean> {
  try {
    const stat = await lstat(target)
    if (!stat.isSymbolicLink()) return false
    await rm(target)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}
