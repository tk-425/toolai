import {describe, expect, it} from 'vitest'
import {parseSelection} from '../src/lib/link/selection.js'

describe('parseSelection', () => {
  const items = ['alpha', 'beta', 'gamma', 'delta']

  it('parses comma-separated numbers', () => {
    expect(parseSelection('1,3', items)).toEqual(['alpha', 'gamma'])
  })

  it('parses numeric ranges', () => {
    expect(parseSelection('2-4', items)).toEqual(['beta', 'gamma', 'delta'])
  })

  it('parses names', () => {
    expect(parseSelection('beta,delta', items)).toEqual(['beta', 'delta'])
  })

  it('supports all', () => {
    expect(parseSelection('all', items)).toEqual(items)
  })

  it('rejects invalid values', () => {
    expect(() => parseSelection('9', items)).toThrow('Invalid selection: 9')
  })
})
