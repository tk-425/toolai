import {Command} from '@oclif/core'
import {createSkillsAdapter} from '../../lib/adapters/skills.js'
import {runLinkFlow} from '../../lib/link/engine.js'
import {getCancelMessage, PromptCancelled, promptForMultiSelect, promptForOperation, promptForScope} from '../../lib/link/prompts.js'

export default class LinkSkills extends Command {
  static override description = 'Interactively manage skill symlinks'

  public async run(): Promise<void> {
    try {
      await runLinkFlow({
        adapter: createSkillsAdapter(this.log.bind(this)),
        promptForScope,
        promptForOperation,
        promptForMultiSelect,
        render: items => {
          for (const item of items) this.log(item)
        }
      })
    } catch (error) {
      if (error instanceof PromptCancelled) {
        this.log(getCancelMessage())
        return
      }

      throw error
    }
  }
}
