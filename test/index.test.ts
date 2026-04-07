import {describe, expect, it, vi} from 'vitest'
import {getCancelMessage} from '../src/lib/link/prompts.js'

describe('handleCliError', () => {
  it('prints a friendly message for prompt cancellation', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const {handleCliError} = await import('../src/index.js')

    await handleCliError(new Error('User force closed the prompt with SIGINT'))

    expect(log).toHaveBeenCalledWith(getCancelMessage())
    log.mockRestore()
  })
})
