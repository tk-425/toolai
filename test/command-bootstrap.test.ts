import {describe, expect, it} from 'vitest'

describe('command modules', () => {
  it('exports link command modules', async () => {
    const skills = await import('../src/commands/link/skills.js')
    const agents = await import('../src/commands/link/agents.js')
    const init = await import('../src/commands/init.js')
    const configPlatformsAdd = await import('../src/commands/config/platforms/add.js')
    const configPlatformsList = await import('../src/commands/config/platforms/list.js')
    const configPlatformsRemove = await import('../src/commands/config/platforms/remove.js')

    expect(skills.default).toBeDefined()
    expect(agents.default).toBeDefined()
    expect(init.default).toBeDefined()
    expect(configPlatformsAdd.default).toBeDefined()
    expect(configPlatformsList.default).toBeDefined()
    expect(configPlatformsRemove.default).toBeDefined()
  })
})
