import {describe, expect, it, vi} from 'vitest'
import {withSpinner} from '../src/lib/terminal/spinner.js'

type FakeOutput = {
  isTTY?: boolean
  writes: string[]
  write: (chunk: string) => boolean
}

function createOutput(isTTY: boolean): FakeOutput {
  const output: FakeOutput = {
    isTTY,
    writes: [],
    write(chunk) {
      this.writes.push(chunk)
      return true
    }
  }
  return output
}

describe('withSpinner', () => {
  it('renders frames and clears the line on success', async () => {
    const output = createOutput(true)
    let tick: (() => void) | undefined
    const setInterval = vi.fn((callback: () => void) => {
      tick = callback
      return 1 as never
    })
    const clearInterval = vi.fn()

    const result = await withSpinner('Inspecting repo', async () => 'done', {
      output,
      setInterval,
      clearInterval
    })
    expect(result).toBe('done')
    expect(setInterval).toHaveBeenCalledOnce()
    expect(clearInterval).toHaveBeenCalledWith(1)
    expect(tick).toBeTypeOf('function')
    expect(output.writes.join('')).toContain('Inspecting repo')
    expect(output.writes.at(-1)).toBe('\r\x1b[2K')
  })

  it('clears the line and preserves the original error on failure', async () => {
    const output = createOutput(true)
    const error = new Error('failed')
    const clearInterval = vi.fn()

    await expect(withSpinner('Publishing', async () => {
      throw error
    }, {
      output,
      setInterval: vi.fn(() => 1 as never),
      clearInterval
    })).rejects.toBe(error)

    expect(clearInterval).toHaveBeenCalledWith(1)
    expect(output.writes.at(-1)).toBe('\r\x1b[2K')
  })

  it('passes through without terminal output when not running in a TTY', async () => {
    const output = createOutput(false)
    const setInterval = vi.fn()
    const result = await withSpinner('Checking', async () => 42, {
      output,
      setInterval
    })

    expect(result).toBe(42)
    expect(setInterval).not.toHaveBeenCalled()
    expect(output.writes).toEqual([])
  })
})
