import {afterEach, describe, expect, it, vi} from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('link prompts', () => {
  it('adds count and guidance to checkbox prompts', async () => {
    const checkbox = vi.fn().mockResolvedValue([])

    vi.doMock('@inquirer/prompts', () => ({
      checkbox,
      select: vi.fn()
    }))

    const {promptForMultiSelect} = await import('../src/lib/link/prompts.js')

    await promptForMultiSelect(
      'Select targets',
      Array.from({length: 11}, (_, index) => ({name: `Item ${index}`, value: `item-${index}`}))
    )

    expect(checkbox).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Select targets (11 available, use arrow keys to see more if needed)',
      pageSize: 10
    }))
  })

  it('adds count and guidance to short checkbox prompts too', async () => {
    const checkbox = vi.fn().mockResolvedValue([])

    vi.doMock('@inquirer/prompts', () => ({
      checkbox,
      select: vi.fn()
    }))

    const {promptForMultiSelect} = await import('../src/lib/link/prompts.js')

    await promptForMultiSelect('Select items', [
      {name: 'One', value: 'one'},
      {name: 'Two', value: 'two'}
    ])

    expect(checkbox).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Select items (2 available, use arrow keys to see more if needed)',
      pageSize: 10
    }))
  })
})
