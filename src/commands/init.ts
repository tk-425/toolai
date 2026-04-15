import {Command} from '@oclif/core'
import {
  DEFAULT_PLATFORM_CONFIG,
  readToolaiConfig,
  getToolaiConfigPath,
  toolaiConfigExists,
  type ToolaiPlatformConfig,
  writeToolaiConfig
} from '../lib/config/toolai-config.js'
import {promptConfirm, promptInput} from '../lib/centralize/prompts.js'
import {getCancelMessage, PromptCancelled} from '../lib/link/prompts.js'
import {formatSuccess, formatWarning} from '../lib/link/theme.js'

function dedupePlatforms(platforms: ToolaiPlatformConfig[]): ToolaiPlatformConfig[] {
  const deduped = new Map<string, ToolaiPlatformConfig>()
  for (const platform of platforms) {
    deduped.set(platform.label, platform)
  }
  return Array.from(deduped.values())
}

export default class Init extends Command {
  static override description = 'Initialize toolai path configuration'

  async run(): Promise<void> {
    try {
      const configPath = getToolaiConfigPath()
      const alreadyInitialized = await toolaiConfigExists()
      const existingConfig = alreadyInitialized ? await readToolaiConfig(configPath) : null

      if (alreadyInitialized) {
        this.log(formatWarning(`toolai is already initialized at ${configPath}`))
        const shouldUpdate = await promptConfirm('Would you like to update the configuration?', false)
        if (!shouldUpdate) return
      }

      const skillsRoot = (await promptInput('What is the central skills location?', existingConfig?.skillsRoot)).trim()
      const agentsRoot = (await promptInput('What is the central agents location?', existingConfig?.agentsRoot)).trim()
      const centralizeRepoRoot = (await promptInput('What is the bundled source repo location?', existingConfig?.centralizeRepoRoot)).trim()
      const basePlatforms = existingConfig?.platforms.length ? existingConfig.platforms : DEFAULT_PLATFORM_CONFIG
      const customPlatforms: ToolaiPlatformConfig[] = []

      let shouldAddCustomPlatform = await promptConfirm('Would you like to add a custom platform?', false)
      while (shouldAddCustomPlatform) {
        const label = (await promptInput('What is the platform label?')).trim()
        const base = (await promptInput('What is the platform base path?')).trim()
        customPlatforms.push({label, base})
        shouldAddCustomPlatform = await promptConfirm('Would you like to add another custom platform?', false)
      }

      await writeToolaiConfig({
        skillsRoot,
        agentsRoot,
        centralizeRepoRoot,
        platforms: dedupePlatforms([...basePlatforms, ...customPlatforms])
      }, configPath)
      this.log(formatSuccess(`Initialized toolai config at ${configPath}`))
    } catch (error) {
      if (error instanceof PromptCancelled) {
        this.log(getCancelMessage())
        return
      }

      throw error
    }
  }
}
