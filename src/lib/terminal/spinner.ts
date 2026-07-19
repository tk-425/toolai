type SpinnerOutput = {
  isTTY?: boolean
  write: (chunk: string) => unknown
}

type SpinnerOptions = {
  output?: SpinnerOutput
  intervalMs?: number
  setInterval?: (callback: () => void, delay: number) => unknown
  clearInterval?: (handle: unknown) => void
}

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const clearLine = '\r\x1b[2K'

export async function withSpinner<T>(
  message: string,
  operation: () => Promise<T>,
  options: SpinnerOptions = {}
): Promise<T> {
  const output = options.output ?? process.stdout
  if (!output.isTTY) return operation()

  const setTimer = options.setInterval ?? ((callback, delay) => setInterval(callback, delay))
  const clearTimer = options.clearInterval ?? ((handle) => clearInterval(handle as ReturnType<typeof setInterval>))
  const intervalMs = options.intervalMs ?? 100
  let frameIndex = 0
  const render = () => output.write(`\r${frames[frameIndex++ % frames.length]} ${message}`)

  render()
  const timer = setTimer(render, intervalMs)
  try {
    return await operation()
  } finally {
    clearTimer(timer)
    output.write(clearLine)
  }
}
