import type { EntryKind, RecordData } from '../storage/types'

export interface RecordDraft {
  kind: EntryKind
  localDateTime: string
  body: string
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

export function isoToLocalDateTime(isoDate: string): string {
  const date = new Date(isoDate)
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('')
}

export function localDateTimeToIso(localDateTime: string): string {
  const date = new Date(localDateTime)
  if (Number.isNaN(date.getTime())) {
    throw new Error('日時を入力してください。')
  }
  return date.toISOString()
}

export function draftFromRecord(record: RecordData): RecordDraft {
  return {
    kind: record.kind,
    localDateTime: isoToLocalDateTime(record.occurredAt),
    body: record.body,
  }
}
