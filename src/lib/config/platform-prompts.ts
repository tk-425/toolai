import {formatWarning} from '../link/theme.js'
import {isDefaultPlatformLabel, type ToolaiPlatformConfig} from './toolai-config.js'

type PromptInput = (message: string, defaultValue?: string) => Promise<string>
type PromptConfirm = (message: string, defaultValue?: boolean) => Promise<boolean>
type Logger = (message?: string) => void

export function findPlatformByLabel(platforms: ToolaiPlatformConfig[], label: string): ToolaiPlatformConfig | undefined {
  return platforms.find(platform => platform.label === label)
}

export async function promptForRequiredValue(
  prompt: PromptInput,
  log: Logger,
  message: string,
  emptyWarning: string
): Promise<string> {
  while (true) {
    const value = (await prompt(message)).trim()
    if (value) return value
    log(formatWarning(emptyWarning))
  }
}

export async function promptForCustomPlatformLabel(
  promptInput: PromptInput,
  promptConfirm: PromptConfirm,
  log: Logger,
  existingPlatforms: ToolaiPlatformConfig[]
): Promise<string> {
  while (true) {
    const label = await promptForRequiredValue(
      promptInput,
      log,
      'What is the platform label?',
      'Platform label cannot be empty.'
    )

    if (isDefaultPlatformLabel(label)) {
      log(formatWarning(`Platform "${label}" is built in and cannot be added as a custom platform.`))
      continue
    }

    const existingPlatform = findPlatformByLabel(existingPlatforms, label)
    if (!existingPlatform) return label

    log(formatWarning(`Platform "${label}" already exists and will be replaced.`))
    const shouldReplace = await promptConfirm(`Would you like to replace the existing platform "${label}"?`, false)
    if (shouldReplace) return label
  }
}
