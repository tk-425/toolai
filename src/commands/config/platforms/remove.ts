import {Command} from '@oclif/core'
import {promptSelect} from '../../../lib/centralize/prompts.js'
import {getStoredCustomPlatforms, getToolaiConfigPath, writeStoredCustomPlatforms} from '../../../lib/config/toolai-config.js'
import {getCancelMessage, PromptCancelled} from '../../../lib/link/prompts.js'
import {formatSuccess, formatWarning} from '../../../lib/link/theme.js'

export default class ConfigPlatformsRemove extends Command {
  static override description = 'Remove a custom global platform'

  async run(): Promise<void> {
    try {
      const configPath = getToolaiConfigPath()
      const customPlatforms = await getStoredCustomPlatforms(configPath)

      if (customPlatforms.length === 0) {
        this.log(formatWarning('No custom global platforms are configured.'))
        return
      }

      const label = await promptSelect(
        'Which custom platform would you like to remove?',
        customPlatforms.map(platform => ({
          name: `${platform.label} (${platform.base})`,
          value: platform.label
        }))
      )

      await writeStoredCustomPlatforms(customPlatforms.filter(platform => platform.label !== label), configPath)
      this.log(formatSuccess(`Removed custom platform "${label}" from ${configPath}`))
    } catch (error) {
      if (error instanceof PromptCancelled) {
        this.log(getCancelMessage())
        return
      }

      throw error
    }
  }
}
