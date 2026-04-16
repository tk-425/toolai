import {Command} from '@oclif/core'
import {getStoredCustomPlatforms, getToolaiConfigPath} from '../../../lib/config/toolai-config.js'
import {formatPathValue, formatSectionLabel, formatWarning} from '../../../lib/link/theme.js'

export default class ConfigPlatformsList extends Command {
  static override description = 'List custom global platforms'

  async run(): Promise<void> {
    const configPath = getToolaiConfigPath()
    const customPlatforms = await getStoredCustomPlatforms(configPath)

    if (customPlatforms.length === 0) {
      this.log(formatWarning('No custom global platforms are configured.'))
      return
    }

    this.log(formatSectionLabel('Custom Platforms'))
    for (const platform of customPlatforms) {
      this.log(`${platform.label} ${formatPathValue(`(${platform.base})`)}`)
    }
  }
}
