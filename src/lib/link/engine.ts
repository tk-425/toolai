import {formatSummaryLine} from './output.js'
import {formatBundleChoiceLabel, formatChoiceLabel, formatTargetChoiceLabel} from './theme.js'
import type {LinkFlowAdapter, Operation, Scope} from './types.js'

interface RunLinkFlowOptions {
  adapter: LinkFlowAdapter
  promptForScope: () => Promise<Scope>
  promptForOperation: () => Promise<Operation>
  promptForMultiSelect: (
    message: string,
    choices: Array<{name: string; value: string; description?: string; disabled?: boolean | string}>
  ) => Promise<string[]>
  render: (items: string[]) => void
}

export async function runLinkFlow(options: RunLinkFlowOptions): Promise<string[]> {
  const scope = await options.promptForScope()
  const operation = await options.promptForOperation()
  const items = await options.adapter.discoverItems(scope, operation)
  const selectedItems = await options.promptForMultiSelect(
    'Select items',
    items.map(item => ({
      name: formatChoiceLabel(
        item.marker,
        item.kind === 'bundle' ? formatBundleChoiceLabel(item.name) : item.name
      ),
      value: item.name,
      disabled: operation === 'add' && item.marker === '[✓]' ? 'Already linked' : undefined,
      description: item.marker === '[-]' ? 'Partially linked' : undefined
    }))
  )

  const targets = await options.adapter.discoverTargets(scope, operation, selectedItems)
  const targetChoices = [
    ...(targets.length > 1 ? [{name: 'All', value: '__all__'}] : []),
    ...targets.map(target => ({
      name: formatTargetChoiceLabel(target.marker, target.name, target.path),
      value: target.name
    }))
  ]
  const selectedTargetValues = await options.promptForMultiSelect(
    'Select targets',
    targetChoices
  )
  const selectedTargets = selectedTargetValues.includes('__all__')
    ? targets.map(target => target.name)
    : selectedTargetValues

  const summary = await options.adapter.apply(scope, operation, selectedItems, selectedTargets)
  options.render(summary.map(formatSummaryLine))
  return summary
}
