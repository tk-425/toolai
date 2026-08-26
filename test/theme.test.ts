import {describe, expect, it} from 'vitest'
import {getCancelMessage, isPromptCancel, PromptCancelled} from '../src/lib/link/prompts.js'
import {formatBundleChoiceLabel, formatBundleLabel, formatChoiceLabel} from '../src/lib/link/theme.js'

describe('theme and prompt cancellation', () => {
  it('formats bundle rows with a visible bundle label', () => {
    expect(formatBundleLabel('expo')).toContain('bundle')
  })

  it('formats checkbox bundle labels with a leading bundle label', () => {
    expect(formatBundleChoiceLabel('expo')).toBe('[Bundle] expo')
  })

  it('preserves standalone choice formatting', () => {
    expect(formatChoiceLabel('[ ]', 'expo-api-routes')).toBe('[ ] expo-api-routes')
  })

  it('returns a friendly cancellation message for Ctrl+C exits', () => {
    expect(isPromptCancel(new PromptCancelled())).toBe(true)
    expect(isPromptCancel(new Error('User force closed the prompt with SIGINT'))).toBe(true)
    expect(getCancelMessage()).toContain('Goodbye.')
  })
})
