import {mkdir, symlink, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {mkdtemp, rm} from 'node:fs/promises'
import {describe, expect, it} from 'vitest'

describe('centralize verification', () => {
  it('requires config files for every installed root', async () => {
    const {verifyConfigPresence} = await import('../src/lib/centralize/verify.js')
    const result = await verifyConfigPresence(
      ['/central/skill-a'],
      async path => path === '/central/skill-a/.centralize-config.json'
    )

    expect(result.ok).toBe(true)
  })

  it('requires symlinks only for bundled aliases', async () => {
    const {verifyAliasTargets} = await import('../src/lib/centralize/verify.js')
    const result = await verifyAliasTargets(
      ['/central/vercel-react-best-practices'],
      async path => path === '/central/vercel-react-best-practices',
      async path => `/central/agent-skills/${path.split('/').pop()}`
    )

    expect(result.ok).toBe(true)
  })

  it('ignores expected SKILL.md name rewrites when comparing directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-verify-dir-'))
    const sourceDir = join(root, 'source')
    const targetDir = join(root, 'target')

    try {
      await mkdir(sourceDir, {recursive: true})
      await mkdir(targetDir, {recursive: true})
      await writeFile(join(sourceDir, 'SKILL.md'), ['---', 'name: native-data-fetching', '---', 'body'].join('\n'))
      await writeFile(join(targetDir, 'SKILL.md'), ['---', 'name: expo-native-data-fetching', '---', 'body'].join('\n'))

      const {directoriesDiffer} = await import('../src/lib/centralize/verify.js')
      await expect(directoriesDiffer(sourceDir, targetDir)).resolves.toBe(false)
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('ignores expected SKILL.md name rewrites when frontmatter uses CRLF line endings', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-verify-dir-crlf-'))
    const sourceDir = join(root, 'source')
    const targetDir = join(root, 'target')

    try {
      await mkdir(sourceDir, {recursive: true})
      await mkdir(targetDir, {recursive: true})
      await writeFile(join(sourceDir, 'SKILL.md'), ['---', 'name: ui-ux-pro-max', 'description: test', '---', 'body'].join('\r\n'))
      await writeFile(join(targetDir, 'SKILL.md'), ['---', 'name: uipro-ui-ux-pro-max', 'description: test', '---', 'body'].join('\r\n'))

      const {directoriesDiffer} = await import('../src/lib/centralize/verify.js')
      await expect(directoriesDiffer(sourceDir, targetDir)).resolves.toBe(false)
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('verifies canonical Skill identity when the source directory basename differs from the SKILL frontmatter name', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-verify-canonical-source-'))
    const sourceRepo = join(root, 'repo')
    const sourceSkill = join(sourceRepo, 'skill')
    const installRoot = join(root, 'central', 'impeccable')
    const installedSkill = join(installRoot, 'i-impeccable')

    try {
      await mkdir(sourceSkill, {recursive: true})
      await mkdir(installedSkill, {recursive: true})
      await writeFile(join(sourceSkill, 'SKILL.md'), ['---', 'name: impeccable', '---', 'body'].join('\n'))
      await writeFile(join(installedSkill, 'SKILL.md'), ['---', 'name: i-impeccable', '---', 'body'].join('\n'))
      await writeFile(join(sourceSkill, 'notes.md'), 'same')
      await writeFile(join(installedSkill, 'notes.md'), 'same')
      await writeFile(
        join(installRoot, '.centralize-config.json'),
        JSON.stringify({
          mode: 'multi-skill-bundle-with-symlinks',
          sourceRepo,
          bundleName: 'impeccable',
          prefix: 'i-',
          discoveredSkills: ['impeccable'],
          installedSkills: ['i-impeccable']
        })
      )

      const {verifyInstallContentMatchesSource} = await import('../src/lib/centralize/verify.js')
      const result = await verifyInstallContentMatchesSource(installRoot)
      expect(result.ok).toBe(true)
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('verifies centralized bundle content against the source repo', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-verify-install-'))
    const sourceRepo = join(root, 'repo')
    const skillsRoot = join(sourceRepo, 'skills')
    const installRoot = join(root, 'central', 'expo')
    const sourceSkill = join(skillsRoot, 'native-data-fetching')
    const installedSkill = join(installRoot, 'expo-native-data-fetching')

    try {
      await mkdir(sourceSkill, {recursive: true})
      await mkdir(installedSkill, {recursive: true})
      await writeFile(join(sourceSkill, 'SKILL.md'), ['---', 'name: native-data-fetching', '---', 'body'].join('\n'))
      await writeFile(join(installedSkill, 'SKILL.md'), ['---', 'name: expo-native-data-fetching', '---', 'body'].join('\n'))
      await writeFile(join(sourceSkill, 'notes.md'), 'same')
      await writeFile(join(installedSkill, 'notes.md'), 'same')
      await writeFile(
        join(installRoot, '.centralize-config.json'),
        JSON.stringify({
          mode: 'multi-skill-bundle-with-symlinks',
          sourceRepo,
          bundleName: 'expo',
          prefix: 'expo-',
          discoveredSkills: ['native-data-fetching'],
          installedSkills: ['expo-native-data-fetching']
        })
      )

      const {verifyInstallContentMatchesSource} = await import('../src/lib/centralize/verify.js')
      const result = await verifyInstallContentMatchesSource(installRoot)
      expect(result.ok).toBe(true)
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('verifies nested-layout bundles against discovered source skill dirs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-verify-nested-'))
    const sourceRepo = join(root, 'repo')
    const sourceSkill = join(sourceRepo, 'plugins', 'ui', 'skills', 'brand')
    const installRoot = join(root, 'central', 'ui-bundle')
    const installedSkill = join(installRoot, 'uipro-brand')

    try {
      await mkdir(sourceSkill, {recursive: true})
      await mkdir(installedSkill, {recursive: true})
      await writeFile(join(sourceSkill, 'SKILL.md'), ['---', 'name: brand', '---', 'body'].join('\n'))
      await writeFile(join(installedSkill, 'SKILL.md'), ['---', 'name: uipro-brand', '---', 'body'].join('\n'))
      await writeFile(join(sourceSkill, 'notes.md'), 'same')
      await writeFile(join(installedSkill, 'notes.md'), 'same')
      await writeFile(
        join(installRoot, '.centralize-config.json'),
        JSON.stringify({
          mode: 'multi-skill-bundle-with-symlinks',
          sourceRepo,
          bundleName: 'ui-bundle',
          prefix: 'uipro-',
          discoveredSkills: ['brand'],
          installedSkills: ['uipro-brand']
        })
      )

      const {verifyInstallContentMatchesSource} = await import('../src/lib/centralize/verify.js')
      const result = await verifyInstallContentMatchesSource(installRoot)
      expect(result.ok).toBe(true)
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('verifies prefixed nested bundle members when only the SKILL name differs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-verify-uipro-'))
    const sourceRepo = join(root, 'repo')
    const sourceSkill = join(sourceRepo, '.claude', 'skills', 'ui-ux-pro-max')
    const installRoot = join(root, 'central', 'ui-ux-pro-max-skill')
    const installedSkill = join(installRoot, 'uipro-ui-ux-pro-max')

    try {
      await mkdir(sourceSkill, {recursive: true})
      await mkdir(installedSkill, {recursive: true})
      await writeFile(
        join(sourceSkill, 'SKILL.md'),
        ['---', 'name: ui-ux-pro-max', 'description: "UI/UX design intelligence"', '---', 'body'].join('\r\n')
      )
      await writeFile(
        join(installedSkill, 'SKILL.md'),
        ['---', 'name: uipro-ui-ux-pro-max', 'description: "UI/UX design intelligence"', '---', 'body'].join('\r\n')
      )
      await writeFile(
        join(installRoot, '.centralize-config.json'),
        JSON.stringify({
          mode: 'multi-skill-bundle-with-symlinks',
          sourceRepo,
          bundleName: 'ui-ux-pro-max-skill',
          prefix: 'uipro-',
          discoveredSkills: ['ui-ux-pro-max'],
          installedSkills: ['uipro-ui-ux-pro-max']
        })
      )

      const {verifyInstallContentMatchesSource} = await import('../src/lib/centralize/verify.js')
      const result = await verifyInstallContentMatchesSource(installRoot)
      expect(result.ok).toBe(true)
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('treats equivalent relative and absolute symlink targets as matching', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolai-verify-symlink-'))
    const sourceDir = join(root, 'source')
    const targetDir = join(root, 'target')
    const sharedRoot = join(root, 'shared')
    const sourceData = join(sharedRoot, 'ui-ux-pro-max', 'data')
    const sourceScripts = join(sharedRoot, 'ui-ux-pro-max', 'scripts')

    try {
      await mkdir(sourceDir, {recursive: true})
      await mkdir(targetDir, {recursive: true})
      await mkdir(sourceData, {recursive: true})
      await mkdir(sourceScripts, {recursive: true})
      await writeFile(join(sourceDir, 'SKILL.md'), ['---', 'name: ui-ux-pro-max', '---', 'body'].join('\n'))
      await writeFile(join(targetDir, 'SKILL.md'), ['---', 'name: uipro-ui-ux-pro-max', '---', 'body'].join('\n'))
      await symlink('../shared/ui-ux-pro-max/data', join(sourceDir, 'data'))
      await symlink(sourceData, join(targetDir, 'data'))
      await symlink('../shared/ui-ux-pro-max/scripts', join(sourceDir, 'scripts'))
      await symlink(sourceScripts, join(targetDir, 'scripts'))

      const {directoriesDiffer} = await import('../src/lib/centralize/verify.js')
      await expect(directoriesDiffer(sourceDir, targetDir)).resolves.toBe(false)
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })
})
