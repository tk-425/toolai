import {describe, expect, it} from 'vitest'
import {formatMenuItem} from '../src/lib/link/output.js'

describe('formatMenuItem', () => {
  it('renders padded numbers and status markers', () => {
    expect(formatMenuItem({index: 3, name: 'alpha', marker: '[ ]'})).toBe('[ ] [ 3]  alpha')
  })
})
