import type { RecordData } from '../storage/types'
import { generateRecordsCsv } from './generate'

export interface CsvDownloadResult {
  count: number
  filename: string
  newest: RecordData | null
  oldest: RecordData | null
}

export function csvExportFilename(now = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `robamimi-dakoku-${year}-${month}-${day}.csv`
}

export function downloadRecordsCsv(records: RecordData[], now = new Date()): CsvDownloadResult {
  const activeRecords = records
    .filter((record) => record.deletedAt === null)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
  const filename = csvExportFilename(now)
  const blob = new Blob([generateRecordsCsv(activeRecords)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)

  return {
    count: activeRecords.length,
    filename,
    newest: activeRecords[0] ?? null,
    oldest: activeRecords.at(-1) ?? null,
  }
}
