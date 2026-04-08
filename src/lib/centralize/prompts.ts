import {checkbox, confirm, input, select} from '@inquirer/prompts'
import {isPromptCancel, PromptCancelled} from '../link/prompts.js'
import type {CentralizeMode, Choice, LayoutChoice, RepoSelectionMode} from './types.js'

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
    }
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

export async function promptSelect<T extends string>(message: string, choices: Array<Choice<T>>): Promise<T> {
  try {
    return await select({message, choices})
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
