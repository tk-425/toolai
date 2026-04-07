import {execute} from '@oclif/core'
import {getCancelMessage, isPromptCancel} from './lib/link/prompts.js'

export async function run(): Promise<void> {
  await execute({dir: import.meta.url})
}

export async function handleCliError(error: unknown): Promise<void> {
  if (isPromptCancel(error) || (error instanceof Error && error.message === getCancelMessage())) {
    console.log(getCancelMessage())
    process.exitCode = 130
    return
  }

  throw error
}

await run().catch(handleCliError)
