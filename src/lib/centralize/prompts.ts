import {checkbox, confirm, input, select} from '@inquirer/prompts'
import {isPromptCancel, PromptCancelled} from '../link/prompts.js'
import type {CentralizeMode, Choice, LayoutChoice, RemovalTarget, RemovalTargetValue, RepoSelectionMode} from './types.js'

const SCROLL_HINT_PAGE_SIZE = 10

export function wrapPromptError(error: unknown): never {
  if (isPromptCancel(error)) throw new PromptCancelled()

  throw error
}

export function buildModeChoices(): Array<Choice<CentralizeMode>> {
  return [
    {
      name: 'Add new',
      value: 'add',
      description: 'copy skills from a source repo into the central store'
    },
    {
      name: 'Update existing',
      value: 'update',
      description: 'sync an existing centralized install from its source repo'
    },
    {
      name: 'Remove existing',
      value: 'remove',
      description: 'remove a centralized skill or bundle from the central store'
    }
  ]
}

export function removalTargetValue(target: RemovalTarget): RemovalTargetValue {
  if (target.kind === 'skill-in-bundle') {
    return `skill-in-bundle:${target.bundleName ?? ''}:${target.name}`
  }
  return `${target.kind}:${target.name}`
}

export function buildRemovalInstallChoices(targets: RemovalTarget[]): Array<Choice<RemovalTargetValue>> {
  const ordered = [...targets].sort((a, b) => {
    const kindOrder = (target: RemovalTarget) => target.kind === 'bundle' ? 0 : 1
    return kindOrder(a) - kindOrder(b) || a.name.localeCompare(b.name)
  })

  return ordered.map(target => ({
    name: target.kind === 'bundle' ? `[Bundle] ${target.name}` : `[Standalone] ${target.name}`,
    value: removalTargetValue(target),
    description: target.kind === 'bundle' ? 'whole bundle' : 'standalone skill'
  }))
}

export function buildRemovalBundleChoices(bundle: RemovalTarget, members: RemovalTarget[]): Array<Choice<RemovalTargetValue>> {
  return [
    {
      name: 'Remove entire bundle',
      value: removalTargetValue(bundle),
      description: 'all skills inside the bundle'
    },
    ...members.map(member => ({
      name: member.name,
      value: removalTargetValue(member),
      description: 'single skill inside the bundle'
    }))
  ]
}

export function buildRepoSelectionChoices(): Array<Choice<RepoSelectionMode>> {
  return [
    {name: 'Configured repos', value: 'configured'},
    {name: 'Custom repo path', value: 'custom'}
  ]
}

export function buildLayoutChoices(): Array<Choice<LayoutChoice>> {
  return [
    {name: 'Root only', value: 'root-only'},
    {name: 'Nested only', value: 'nested-only'},
    {name: 'Both', value: 'both'}
  ]
}

function formatScrollableMessage(message: string, choiceCount: number): string {
  return `${message} (${choiceCount} available, use arrow keys to see more if needed)`
}

export async function promptSelect<T extends string>(message: string, choices: Array<Choice<T>>): Promise<T> {
  try {
    return await select({
      message: formatScrollableMessage(message, choices.length),
      choices,
      pageSize: SCROLL_HINT_PAGE_SIZE
    })
  } catch (error) {
    wrapPromptError(error)
  }
}

export async function promptInput(message: string, defaultValue?: string): Promise<string> {
  try {
    return await input({message, default: defaultValue})
  } catch (error) {
    wrapPromptError(error)
  }
}

export async function promptConfirm(message: string, defaultValue = true): Promise<boolean> {
  try {
    return await confirm({message, default: defaultValue})
  } catch (error) {
    wrapPromptError(error)
  }
}

export {checkbox, confirm, input, select}
