import {readFile} from 'node:fs/promises'
import {describe, expect, it} from 'vitest'

describe('README', () => {
  it('documents the link commands', async () => {
    const readme = await readFile('README.md', 'utf8')
    expect(readme).toContain('toolai link skills')
    expect(readme).toContain('toolai link agents')
    expect(readme).toContain('space')
    expect(readme).toContain('bundle')
    expect(readme).toContain('Ctrl+C')
  })
})
