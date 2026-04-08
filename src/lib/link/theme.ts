import pc from 'picocolors'

export function formatBundleLabel(name: string): string {
  return `${pc.bold(name)} ${pc.dim('(bundle)')}`
}

export function formatBundleChoiceLabel(name: string): string {
  return `${name} (Bundle)`
}

export function formatChoiceLabel(marker: string, name: string): string {
  return `${marker} ${name}`
}

export function formatTargetChoiceLabel(marker: string, name: string, path: string): string {
  return `${marker} ${name} ${pc.dim(`(${path})`)}`
}

export function formatExitMessage(): string {
  return pc.dim('Goodbye.')
}

export function formatSectionLabel(label: string): string {
  return pc.cyan(pc.bold(label))
}

export function formatFieldLabel(label: string): string {
  return pc.cyan(label.padEnd(8))
}

export function formatFieldValue(value: string): string {
  return pc.white(value)
}

export function formatPathValue(value: string): string {
  return pc.dim(value)
}

export function formatSuccess(text: string): string {
  return pc.green(text)
}

export function formatWarning(text: string): string {
  return pc.yellow(text)
}
