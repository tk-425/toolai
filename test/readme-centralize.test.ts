import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

describe('README centralize docs', () => {
  it('documents the centralize skills command', () => {
    const readme = readFileSync('README.md', 'utf8')

    expect(readme).toContain('toolai centralize skills')
    expect(readme).toContain('Add new')
    expect(readme).toContain('Update existing')
    expect(readme).toContain('every ordered repo root')
    expect(readme).toContain('preserves existing roots')
  })
})
