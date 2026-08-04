import type { DiagnosticLog } from '../storage/types'

export const DIAGNOSTIC_RETENTION_DAYS = 30
export const DIAGNOSTIC_MAX_ENTRIES = 500

export function diagnosticIdsToDelete(logs: DiagnosticLog[], nowMilliseconds = Date.now()): number[] {
  const cutoff = nowMilliseconds - DIAGNOSTIC_RETENTION_DAYS * 24 * 60 * 60 * 1_000
  return [...logs]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .flatMap((log, index) => {
      if (log.id === undefined) return []
      return index >= DIAGNOSTIC_MAX_ENTRIES || new Date(log.occurredAt).getTime() < cutoff ? [log.id] : []
    })
}
