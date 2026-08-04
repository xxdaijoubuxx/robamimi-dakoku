import type { RecordData } from '../storage/types'

const KIND_LABELS: Record<RecordData['kind'], string> = {
  wake: '起床',
  sleep: '就寝',
  memo: 'メモ',
}

function csvField(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

export function csvDateTime(record: RecordData): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: record.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(record.occurredAt))
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')} ${record.timezone}`
}

export function generateRecordsCsv(records: RecordData[]): string {
  const activeNewestFirst = records
    .filter((record) => record.deletedAt === null)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
  const rows = activeNewestFirst.map((record) => [
    csvDateTime(record), KIND_LABELS[record.kind], record.body,
  ].map(csvField).join(','))
  return `\uFEFF${['日時', '種類', '本文'].map(csvField).join(',')}\r\n${rows.join('\r\n')}${rows.length ? '\r\n' : ''}`
}
