import path from 'node:path'
import os from 'node:os'
import {lstat, readdir} from 'node:fs/promises'

export function resolvePath(p: string): string {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1))
  }
  return path.resolve(p)
}

export async function safeReaddir(dir: string) {
  try {
    return await readdir(dir, {withFileTypes: true})
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export async function pathIsSymlink(candidate: string): Promise<boolean> {
  try {
    const stat = await lstat(candidate)
    return stat.isSymbolicLink()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}
