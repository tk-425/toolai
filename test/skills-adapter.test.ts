import {describe, expect, it} from 'vitest'
import {
  buildBundleEntries,
  detectBundles,
  isGlobalSkill,
  shouldHideStandaloneBundleSource
} from '../src/lib/adapters/skills.js'
import {getLinkMarker, targetVisible} from '../src/lib/adapters/helpers.js'

describe('skills adapter', () => {
  it('filters global skills', () => {
    expect(isGlobalSkill('symlink-skills')).toBe(true)
    expect(isGlobalSkill('bootstrap-web')).toBe(false)
  })

  it('detects bundle aliases from top-level symlink targets', () => {
    const aliases = new Map([
      ['autoplan', 'gstack/autoplan'],
      ['i-adapt', 'impeccable/i-adapt']
    ])

    expect(detectBundles(aliases)).toEqual(
      new Map([
        ['gstack', ['autoplan']],
        ['impeccable', ['i-adapt']]
      ])
    )
  })

  it('returns one bundle row instead of one row per bundle member', () => {
    const entries = buildBundleEntries(
      new Map([
        ['expo', ['expo-api-routes', 'expo-dev-client']]
      ]),
      new Map([
        ['expo-api-routes', 0],
        ['expo-dev-client', 0]
      ]),
      2,
      'add'
    )

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      name: 'expo',
      detail: 'bundle',
      kind: 'bundle',
      members: ['expo-api-routes', 'expo-dev-client']
    })
  })

  it('hides duplicate standalone bundle source directories', () => {
    expect(
      shouldHideStandaloneBundleSource(
        'agent-skills',
        new Set(['vercel-labs-agent-skills']),
        new Map([
          ['vercel-labs-agent-skills', [
            'vercel-cli-with-tokens',
            'vercel-composition-patterns',
            'vercel-deploy-to-vercel'
          ]]
        ]),
        [
          'vercel-cli-with-tokens',
          'vercel-composition-patterns',
          'vercel-deploy-to-vercel'
        ]
      )
    ).toBe(true)
  })

  it('marks partial skill coverage with [-]', () => {
    expect(getLinkMarker(1, 3)).toBe('[-]')
  })

  it('shows only linked targets during remove flows', () => {
    expect(targetVisible('remove', 0)).toBe(false)
    expect(targetVisible('remove', 1)).toBe(true)
  })
})
