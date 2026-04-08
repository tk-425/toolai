import type {VerificationResult} from './types.js'

export async function verifyConfigPresence(
  installedRoots: string[],
  pathExists: (path: string) => Promise<boolean>
): Promise<VerificationResult> {
  const failures: string[] = []

  for (const root of installedRoots) {
    const configPath = `${root}/.centralize-config.json`
    if (!(await pathExists(configPath))) failures.push(configPath)
  }

  return {
    ok: failures.length === 0,
    checkedPaths: installedRoots,
    failures
  }
}

export async function verifyAliasTargets(
  aliases: string[],
  isSymlink: (path: string) => Promise<boolean>,
  readLink: (path: string) => Promise<string>
): Promise<VerificationResult> {
  const failures: string[] = []

  for (const alias of aliases) {
    if (!(await isSymlink(alias))) {
      failures.push(alias)
      continue
    }

    try {
      await readLink(alias)
    } catch {
      failures.push(alias)
    }
  }

  return {
    ok: failures.length === 0,
    checkedPaths: aliases,
    failures
  }
}
