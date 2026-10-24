import {describe, expect, it} from 'vitest'

describe('centralize output', () => {
  it('computes added and removed skill names', async () => {
    const {diffSkills} = await import('../src/lib/centralize/output.js')
    const diff = diffSkills(['sp-a', 'sp-b'], ['sp-b', 'sp-c'])

    expect(diff).toEqual({
      added: ['sp-c'],
      removed: ['sp-a']
    })
  })

  it('formats a compact preview summary without dumping raw json', async () => {
    const {formatPreviewSummary} = await import('../src/lib/centralize/output.js')
    const lines = formatPreviewSummary(
      {
        kind: 'bundle',
        mode: 'multi-skill-bundle-with-symlinks',
        name: 'superpowers',
        prefix: 'sp-',
        sourceRepo: '/repo/superpowers',
        installedRoot: '/central/superpowers'
      },
      {
        mode: 'multi-skill-bundle-with-symlinks',
        dryRun: true,
        bundleName: 'superpowers',
        prefix: 'sp-',
        discoveredSkills: ['brainstorming'],
        installedSkills: ['sp-brainstorming'],
        contentChangedSkills: [],
        publishedTo: '/central/superpowers'
      },
      {added: ['sp-brainstorming'], removed: []}
    )

    expect(lines.some(line => line.includes('Install') && line.includes('superpowers'))).toBe(true)
    expect(lines.some(line => line.includes('Skills') && line.includes('1'))).toBe(true)
    expect(lines.some(line => line.includes('Added skills'))).toBe(true)
    expect(lines).not.toContain('{')
  })

  it('formats compact inspection and publish-plan summaries', async () => {
    const {formatInspectionSummary, formatPublishPlanSummary} = await import('../src/lib/centralize/output.js')
    const inspection = formatInspectionSummary({
      repo: '/repo/expo',
      layout: 'nested-only',
      rootSkillName: 'none',
      nestedSkillCount: 12
    })
    const plan = formatPublishPlanSummary({
      repo: '/repo/expo',
      layout: 'nested-only',
      bundle: 'expo',
      prefix: 'expo',
      skillCount: 12
    })

    expect(inspection.some(line => line.includes('Repo'))).toBe(true)
    expect(inspection.some(line => line.includes('12'))).toBe(true)
    expect(plan.some(line => line.includes('Bundle'))).toBe(true)
    expect(plan.some(line => line.includes('Prefix'))).toBe(true)
  })

  it('formats a compact publish summary for add-new results', async () => {
    const {formatPublishSummary} = await import('../src/lib/centralize/output.js')
    const lines = formatPublishSummary(
      {
        kind: 'bundle',
        mode: 'multi-skill-bundle-with-symlinks',
        name: 'expo',
        prefix: 'expo',
        sourceRepo: '/repo/expo',
        installedRoot: '/central/expo'
      },
      {
        mode: 'multi-skill-bundle-with-symlinks',
        dryRun: false,
        bundleName: 'expo',
        prefix: 'expo-',
        discoveredSkills: ['expo-api-routes'],
        installedSkills: ['expo-api-routes'],
        contentChangedSkills: [],
        publishedTo: '/central/expo'
      }
    )

    expect(lines).toContain('Publish complete')
    expect(lines.some(line => line.includes('Install') && line.includes('expo'))).toBe(true)
    expect(lines.some(line => line.includes('Symlinks') && line.includes('1'))).toBe(true)
    expect(lines).not.toContain('{')
  })

  it('formats removal preview and summary for all three target shapes', async () => {
    const {formatRemovalPreview, formatRemovalSummary} = await import('../src/lib/centralize/output.js')

    const bundlePreview = formatRemovalPreview({
      target: {kind: 'bundle', name: 'bundle-pack'},
      paths: ['/central/bundle-pack', '/central/pref-alpha'],
      manifestEntries: ['pref-alpha', 'pref-beta']
    })
    expect(bundlePreview).toContain('Removal preview')
    expect(bundlePreview.some(line => line.includes('bundle-pack'))).toBe(true)
    expect(bundlePreview.some(line => line.includes('pref-alpha'))).toBe(true)

    const skillPreview = formatRemovalPreview({
      target: {kind: 'skill-in-bundle', name: 'pref-alpha', bundleName: 'bundle-pack'},
      paths: ['/central/bundle-pack/pref-alpha', '/central/pref-alpha'],
      manifestEntries: ['pref-alpha'],
      configRewrite: {
        configPath: '/central/bundle-pack/.centralize-config.json',
        installedSkills: ['pref-beta'],
        discoveredSkills: ['beta']
      },
      removesBundle: false
    })
    expect(skillPreview.some(line => line.includes('Remaining skills'))).toBe(true)
    expect(skillPreview.some(line => line.includes('pref-beta'))).toBe(true)
    expect(skillPreview.some(line => line.includes('.centralize-config.json'))).toBe(true)

    const lastSkillPreview = formatRemovalPreview({
      target: {kind: 'skill-in-bundle', name: 'pref-only', bundleName: 'single-pack'},
      paths: ['/central/single-pack/pref-only', '/central/pref-only'],
      manifestEntries: ['pref-only'],
      configRewrite: {
        configPath: '/central/single-pack/.centralize-config.json',
        installedSkills: [],
        discoveredSkills: []
      },
      removesBundle: true
    })
    expect(lastSkillPreview.some(line => line.includes('now-empty bundle'))).toBe(true)

    const summary = formatRemovalSummary({
      target: {kind: 'standalone', name: 'my-skill'},
      removedPaths: ['/central/my-skill'],
      removedManifestEntries: ['my-skill'],
      skippedPaths: []
    })
    expect(summary).toContain('Removal complete')
    expect(summary.some(line => line.includes('my-skill'))).toBe(true)

    const absentSummary = formatRemovalSummary({
      target: {kind: 'standalone', name: 'my-skill'},
      removedPaths: [],
      removedManifestEntries: [],
      skippedPaths: ['/central/my-skill'],
      message: 'Target was already removed.'
    })
    expect(absentSummary.some(line => line.includes('Target was already removed.'))).toBe(true)
  })
})
