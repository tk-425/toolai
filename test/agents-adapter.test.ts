import {describe, expect, it} from 'vitest'
import {toAgentName, toAgentSourcePath} from '../src/lib/adapters/agents.js'
import {targetVisible} from '../src/lib/adapters/helpers.js'

describe('agents adapter', () => {
  it('strips the md suffix for display names', () => {
    expect(toAgentName('explorer.md')).toBe('explorer')
  })

  it('builds source paths from agent names', () => {
    expect(toAgentSourcePath('explorer')).toBe('~/.agent-tools/agents/explorer.md')
  })

  it('shows only linked targets during remove flows', () => {
    expect(targetVisible('remove', 0)).toBe(false)
    expect(targetVisible('remove', 1)).toBe(true)
  })
})
