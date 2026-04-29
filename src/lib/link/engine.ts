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
  if (items.length === 0) {
    options.render([
      'No items are available for the selected scope and operation.'
    ])
    return []
  }

  const itemChoices = items.map(item => ({
    name: formatChoiceLabel(
      item.marker,
      item.kind === 'bundle' ? formatBundleChoiceLabel(item.name) : item.name
    ),
    value: item.name,
    disabled: operation === 'add' && item.marker === '[✓]' ? 'Already linked' : undefined,
    description: item.marker === '[-]' ? 'Partially linked' : undefined
  }))

  if (itemChoices.every(choice => choice.disabled)) {
    options.render([
      'All discovered items are already linked for the selected scope.'
    ])
    return []
  }

  const selectedItems = await options.promptForMultiSelect(
    'Select items',
    itemChoices
  )

  const expandedItems: string[] = []
  const itemsByName = new Map(items.map(item => [item.name, item]))

  for (const itemName of selectedItems) {
    const item = itemsByName.get(itemName)
    if (item?.kind === 'bundle' && item.members) {
      const memberChoices = [
        {name: 'All', value: '__all__'},
        ...item.members.map(member => ({
          name: member,
          value: member
        }))
      ]
      const selectedMembers = await options.promptForMultiSelect(
        `Select members from ${itemName}`,
        memberChoices
      )
      if (selectedMembers.includes('__all__')) {
        expandedItems.push(...item.members)
      } else {
        expandedItems.push(...selectedMembers)
      }
    } else {
      expandedItems.push(itemName)
    }
  }

  const targets = await options.adapter.discoverTargets(scope, operation, expandedItems)
  if (targets.length === 0) {
    options.render([
      'No targets available for the selected scope. If you chose project scope, run this command from the project root or choose global.'
    ])
    return []
  }
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

  const summary = await options.adapter.apply(scope, operation, expandedItems, selectedTargets)
  options.render(summary.map(formatSummaryLine))
  return summary
}
