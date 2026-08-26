import {describe, expect, it} from 'vitest'
import SkillsCommand from '../src/commands/link/skills.js'

describe('link skills command', () => {
  it('exposes the interactive command class', () => {
    expect(SkillsCommand.description).toContain('skill symlinks')
  })
})
