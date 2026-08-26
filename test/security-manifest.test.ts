import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach, describe, expect, it} from 'vitest'
import {SkillManifest} from '../src/lib/security/skill-manifest.js'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.map(root => rm(root, {recursive: true, force: true})))
  tempRoots.length = 0
})

describe('SkillManifest', () => {
  describe('computeHash', () => {
    it('produces a deterministic hash for a given directory', async () => {
      const root = await mkdtemp(join(tmpdir(), 'toolai-manifest-hash-'))
      tempRoots.push(root)
      const skillDir = join(root, 'my-skill')
      await mkdir(skillDir, {recursive: true})
      await writeFile(join(skillDir, 'SKILL.md'), '---\nname: test\n---\n')
      await writeFile(join(skillDir, 'README.md'), '# Test skill')

      const manifest = new SkillManifest(join(root, 'manifest.json'))
      const hash1 = await manifest.computeHash(skillDir)
      const hash2 = await manifest.computeHash(skillDir)

      expect(hash1).toBe(hash2)
      expect(typeof hash1).toBe('string')
      expect(hash1.length).toBe(64)
    })

    it('produces different hashes for different directory contents', async () => {
      const root = await mkdtemp(join(tmpdir(), 'toolai-manifest-hash-diff-'))
      tempRoots.push(root)
      const skillDir1 = join(root, 'skill-a')
      const skillDir2 = join(root, 'skill-b')
      await mkdir(skillDir1, {recursive: true})
      await mkdir(skillDir2, {recursive: true})
      await writeFile(join(skillDir1, 'SKILL.md'), '---\nname: a\n---\n')
      await writeFile(join(skillDir2, 'SKILL.md'), '---\nname: b\n---\n')

      const manifest = new SkillManifest(join(root, 'manifest.json'))
      const hash1 = await manifest.computeHash(skillDir1)
      const hash2 = await manifest.computeHash(skillDir2)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('addOrUpdateSkill', () => {
    it('upserts an entry with correct fields', async () => {
      const root = await mkdtemp(join(tmpdir(), 'toolai-manifest-upsert-'))
      tempRoots.push(root)
      const manifestPath = join(root, 'manifest.json')
      const manifest = new SkillManifest(manifestPath)

      await manifest.addOrUpdateSkill('test-skill', 'abc123', '2026-01-01T00:00:00Z')

      const data = await manifest.read()
      expect(data.skills['test-skill']).toEqual({
        name: 'test-skill',
        hash: 'abc123',
        status: 'pending',
        updatedAt: '2026-01-01T00:00:00Z',
        scannedAt: null
      })
    })

    it('overwrites existing entry on second call', async () => {
      const root = await mkdtemp(join(tmpdir(), 'toolai-manifest-overwrite-'))
      tempRoots.push(root)
      const manifestPath = join(root, 'manifest.json')
      const manifest = new SkillManifest(manifestPath)

      await manifest.addOrUpdateSkill('test-skill', 'hash1', '2026-01-01T00:00:00Z')
      await manifest.addOrUpdateSkill('test-skill', 'hash2', '2026-01-02T00:00:00Z')

      const data = await manifest.read()
      expect(Object.keys(data.skills)).toHaveLength(1)
      expect(data.skills['test-skill'].hash).toBe('hash2')
      expect(data.skills['test-skill'].status).toBe('pending')
    })
  })

  describe('removeSkill', () => {
    it('deletes an entry from the manifest', async () => {
      const root = await mkdtemp(join(tmpdir(), 'toolai-manifest-remove-'))
      tempRoots.push(root)
      const manifestPath = join(root, 'manifest.json')
      const manifest = new SkillManifest(manifestPath)

      await manifest.addOrUpdateSkill('to-remove', 'hash', '2026-01-01T00:00:00Z')
      await manifest.removeSkill('to-remove')

      const data = await manifest.read()
      expect(data.skills['to-remove']).toBeUndefined()
    })
  })

  describe('read/write round-trip', () => {
    it('returns empty skeleton when manifest does not exist', async () => {
      const root = await mkdtemp(join(tmpdir(), 'toolai-manifest-empty-'))
      tempRoots.push(root)
      const manifest = new SkillManifest(join(root, 'nonexistent.json'))

      const data = await manifest.read()

      expect(data).toEqual({last_updated: '', skills: {}})
    })

    it('persists and retrieves a manifest correctly', async () => {
      const root = await mkdtemp(join(tmpdir(), 'toolai-manifest-roundtrip-'))
      tempRoots.push(root)
      const manifestPath = join(root, 'manifest.json')
      const manifest = new SkillManifest(manifestPath)

      await manifest.addOrUpdateSkill('skill-one', 'hash1', '2026-01-01T00:00:00Z')
      await manifest.addOrUpdateSkill('skill-two', 'hash2', '2026-01-02T00:00:00Z')

      const freshManifest = new SkillManifest(manifestPath)
      const data = await freshManifest.read()

      expect(Object.keys(data.skills)).toHaveLength(2)
      expect(data.skills['skill-one'].hash).toBe('hash1')
      expect(data.skills['skill-two'].hash).toBe('hash2')
    })
  })
})