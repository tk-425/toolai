import {Command} from '@oclif/core'
import {createAgentsAdapter} from '../../lib/adapters/agents.js'
import {runLinkFlow} from '../../lib/link/engine.js'
import {getCancelMessage, PromptCancelled, promptForMultiSelect, promptForOperation, promptForScope} from '../../lib/link/prompts.js'

export default class LinkAgents extends Command {
  static override description = 'Interactively manage agent symlinks'

  public async run(): Promise<void> {
    try {
      await runLinkFlow({
        adapter: createAgentsAdapter(this.log.bind(this)),
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
