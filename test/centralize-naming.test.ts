import {describe, expect, it} from 'vitest'

describe('centralize naming', () => {
  it('derives the default bundle name from the source repo basename', async () => {
    const {getDefaultBundleName} = await import('../src/lib/centralize/naming.js')

    expect(getDefaultBundleName('/Users/terrykang/dev/vercel-labs/agent-skills')).toBe('agent-skills')
  })

  it('does not double-prefix skills that already start with the chosen prefix', async () => {
    const {applyPrefix} = await import('../src/lib/centralize/naming.js')

    expect(applyPrefix('vercel-react-best-practices', 'vercel')).toBe('vercel-react-best-practices')
    expect(applyPrefix('react-best-practices', 'vercel')).toBe('vercel-react-best-practices')
  })

  it('reports both install-root and alias conflicts', async () => {
    const {detectConflicts} = await import('../src/lib/centralize/naming.js')

    const result = await detectConflicts({
      centralRoot: '/central',
      installRoots: ['/central/agent-skills'],
      topLevelAliases: ['/central/vercel-react-best-practices'],
      pathExists: async path => path === '/central/agent-skills' || path === '/central/vercel-react-best-practices'
    })

    expect(result.map(item => item.type)).toEqual(['install-root', 'alias'])
  })
})
