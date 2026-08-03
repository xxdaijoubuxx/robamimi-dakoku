import type { HistoryEntry } from '../storage/types'

export interface HistoryGroup {
  key: string
  label: string
  entries: HistoryEntry[]
}

function dateParts(isoDate: string, timezone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).formatToParts(new Date(isoDate))
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function historyDateKey(isoDate: string, timezone: string): string {
  const parts = dateParts(isoDate, timezone)
  return `${parts.year ?? ''}-${parts.month ?? ''}-${parts.day ?? ''}`
}

export function historyDateLabel(isoDate: string, timezone: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  }).format(new Date(isoDate))
}

export function historyTimeLabel(isoDate: string, timezone: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  }).format(new Date(isoDate))
}

export function groupHistoryEntries(entries: HistoryEntry[]): HistoryGroup[] {
  const groups: HistoryGroup[] = []

  for (const entry of entries) {
    const key = historyDateKey(entry.record.occurredAt, entry.record.timezone)
    const lastGroup = groups.at(-1)
    if (lastGroup?.key === key) {
      lastGroup.entries.push(entry)
    } else {
      groups.push({
        key,
        label: historyDateLabel(entry.record.occurredAt, entry.record.timezone),
        entries: [entry],
      })
    }
  }

  return groups
}
