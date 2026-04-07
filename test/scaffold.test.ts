import {existsSync, readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

describe('project scaffold', () => {
  it('creates the CLI entry files', () => {
    expect(existsSync('package.json')).toBe(true)
    expect(existsSync('tsconfig.json')).toBe(true)
    expect(existsSync('bin/run.js')).toBe(true)
    expect(existsSync('src/index.ts')).toBe(true)
  })

  it('wires the runtime entrypoints through src/index.ts', () => {
    const binRun = readFileSync('bin/run.js', 'utf8')
    const sourceEntry = readFileSync('src/index.ts', 'utf8')

    expect(binRun).toContain("import('../dist/src/index.js')")
    expect(sourceEntry).toContain("from '@oclif/core'")
    expect(sourceEntry).toContain('await execute({dir: import.meta.url})')
  })
})
