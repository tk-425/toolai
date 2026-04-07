export function parseSelection(input: string, items: string[]): string[] {
  const trimmed = input.trim()
  if (trimmed === 'all') return [...items]

  const results = new Set<string>()
  const parts = trimmed.split(',').map(part => part.trim()).filter(Boolean)

  for (const part of parts) {
    const range = part.match(/^(\d+)-(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      for (let index = start; index <= end; index += 1) {
        const value = items[index - 1]
        if (!value) throw new Error(`Invalid selection: ${part}`)
        results.add(value)
      }

      continue
    }

    const index = Number(part)
    if (!Number.isNaN(index) && part !== '') {
      const value = items[index - 1]
      if (!value) throw new Error(`Invalid selection: ${part}`)
      results.add(value)
      continue
    }

    if (!items.includes(part)) {
      throw new Error(`Invalid selection: ${part}`)
    }

    results.add(part)
  }

  return [...results]
}
