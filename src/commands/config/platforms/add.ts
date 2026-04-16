import {Command} from '@oclif/core'
import {promptConfirm, promptInput} from '../../../lib/centralize/prompts.js'
import {promptForCustomPlatformLabel, promptForRequiredValue} from '../../../lib/config/platform-prompts.js'
import {
  getStoredCustomPlatforms,
  getToolaiConfigPath,
  mergePlatforms,
  writeStoredCustomPlatforms
} from '../../../lib/config/toolai-config.js'
import {getCancelMessage, PromptCancelled} from '../../../lib/link/prompts.js'
import {formatSuccess} from '../../../lib/link/theme.js'

export default class ConfigPlatformsAdd extends Command {
  static override description = 'Add a custom global platform'

  async run(): Promise<void> {
    try {
      const configPath = getToolaiConfigPath()
      const customPlatforms = await getStoredCustomPlatforms(configPath)
      const label = await promptForCustomPlatformLabel(
        promptInput,
        promptConfirm,
        this.log.bind(this),
        customPlatforms
      )
      const base = await promptForRequiredValue(
        promptInput,
        this.log.bind(this),
        'What is the platform base path?',
        'Platform base path cannot be empty.'
      )

      await writeStoredCustomPlatforms(mergePlatforms([...customPlatforms, {label, base}]), configPath)
      this.log(formatSuccess(`Saved custom platform "${label}" to ${configPath}`))
    } catch (error) {
      if (error instanceof PromptCancelled) {
        this.log(getCancelMessage())
        return
      }

      throw error
    }
  }
}
