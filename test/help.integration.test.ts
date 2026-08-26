import {execFileSync} from 'node:child_process'
import {describe, expect, it} from 'vitest'

function runHelp(...args: string[]): string {
  return execFileSync(process.execPath, ['./bin/run.js', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  })
}

describe('help output', () => {
  it('shows a descriptive config topic in root help', () => {
    const output = runHelp('--help')
    expect(output).toContain('config      Manage toolai configuration')
  })

  it('shows a descriptive config topic help page', () => {
    const output = runHelp('config', '--help')
    expect(output).toContain('Manage toolai configuration')
    expect(output).toContain('config platforms  Manage custom global platforms')
  })

  it('shows a descriptive config platforms topic help page', () => {
    const output = runHelp('config', 'platforms', '--help')
    expect(output).toContain('Manage custom global platforms')
    expect(output).toContain('config platforms add')
    expect(output).toContain('config platforms list')
    expect(output).toContain('config platforms remove')
  })
})
