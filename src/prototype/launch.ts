import type { EntryKind } from './types'

export type LaunchMode = 'prepare' | 'completed' | 'record'

export function launchMode(search: string): LaunchMode {
  const params = new URLSearchParams(search)
  if (params.get('install') === '1') return 'prepare'
  if (params.get('done') === '1') return 'completed'
  return 'record'
}

export function completedLaunchUrl(baseUrl: string, kind: EntryKind): string {
  return `${baseUrl}${kind}/?done=1`
}
