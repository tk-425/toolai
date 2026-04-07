import {mkdtemp, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {describe, expect, it} from 'vitest'
import {ensureSymlink, removeSymlinkOnly} from '../src/lib/fs/symlinks.js'

describe('symlink helpers', () => {
  it('creates a symlink when the target path is missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'toolai-'))
    const source = path.join(root, 'source.txt')
    const target = path.join(root, 'target.txt')

    await writeFile(source, 'ok')
    await ensureSymlink(source, target)

    expect(await removeSymlinkOnly(target)).toBe(true)
  })

  it('refuses to remove a real file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'toolai-'))
    const file = path.join(root, 'file.txt')

    await writeFile(file, 'real')

    await expect(removeSymlinkOnly(file)).resolves.toBe(false)
  })
})
