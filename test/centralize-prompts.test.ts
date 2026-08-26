import {afterEach, describe, expect, it, vi} from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('centralize prompts', () => {
  it('adds count and guidance to select prompts', async () => {
    const select = vi.fn().mockResolvedValue('value')

    vi.doMock('@inquirer/prompts', () => ({
      checkbox: vi.fn(),
      confirm: vi.fn(),
      input: vi.fn(),
      select
    }))

    const {promptSelect} = await import('../src/lib/centralize/prompts.js')

    await promptSelect(
      'Which centralized install would you like to update?',
      Array.from({length: 12}, (_, index) => ({name: `Install ${index}`, value: `install-${index}` as const}))
    )

    expect(select).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Which centralized install would you like to update? (12 available, use arrow keys to see more if needed)',
      pageSize: 10
    }))
  })
})
