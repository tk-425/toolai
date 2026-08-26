import {describe, expect, it} from 'vitest'
import AgentsCommand from '../src/commands/link/agents.js'

describe('link agents command', () => {
  it('exposes the interactive command class', () => {
    expect(AgentsCommand.description).toContain('agent symlinks')
  })
})
