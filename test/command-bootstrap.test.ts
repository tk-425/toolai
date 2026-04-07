import {describe, expect, it} from 'vitest'

describe('command modules', () => {
  it('exports link command modules', async () => {
    const skills = await import('../src/commands/link/skills.js')
    const agents = await import('../src/commands/link/agents.js')

    expect(skills.default).toBeDefined()
    expect(agents.default).toBeDefined()
  })
})
