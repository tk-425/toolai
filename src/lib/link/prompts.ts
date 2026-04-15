import {checkbox, select} from '@inquirer/prompts'
import type {Operation, Scope} from './types.js'
import {formatExitMessage} from './theme.js'

export class PromptCancelled extends Error {
  constructor() {
    super(formatExitMessage())
    this.name = 'PromptCancelled'
  }
}

export function isPromptCancel(error: unknown): boolean {
  return error instanceof PromptCancelled || (error instanceof Error && error.message.includes('SIGINT'))
}

export function getCancelMessage(): string {
  return formatExitMessage()
}

export async function promptForScope(): Promise<Scope> {
  try {
    return await select({
      message: 'Where would you like to manage links?',
      choices: [
        {name: 'Project', value: 'project'},
        {name: 'Global', value: 'global'}
      ]
    })
  } catch (error) {
    if (isPromptCancel(error)) throw new PromptCancelled()
    throw error
  }
}

export async function promptForOperation(): Promise<Operation> {
  try {
    return await select({
      message: 'What would you like to do?',
      choices: [
        {name: 'Add', value: 'add'},
        {name: 'Remove', value: 'remove'}
      ]
    })
  } catch (error) {
    if (isPromptCancel(error)) throw new PromptCancelled()
    throw error
  }
}

export async function promptForMultiSelect(
  message: string,
  choices: Array<{name: string; value: string; description?: string; disabled?: boolean | string}>
): Promise<string[]> {
  try {
    return await checkbox({message, choices})
  } catch (error) {
    if (isPromptCancel(error)) throw new PromptCancelled()
    throw error
  }
}
