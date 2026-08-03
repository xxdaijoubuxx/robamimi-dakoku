import { getPendingNewRecords } from '../storage/database'
import { uploadNewRecord, type UploadOutcome } from './upload'

export interface SyncRunResult {
  total: number
  outcomes: Record<UploadOutcome, number>
}

let activeRun: Promise<SyncRunResult> | null = null

export function syncPendingNewRecords(): Promise<SyncRunResult> {
  if (activeRun) return activeRun

  activeRun = (async () => {
    const records = await getPendingNewRecords()
    const outcomes: Record<UploadOutcome, number> = {
      synced: 0, pending: 0, failed: 0, 'reauth-required': 0,
    }
    for (const record of records) {
      outcomes[await uploadNewRecord(record)] += 1
    }
    return { total: records.length, outcomes }
  })().finally(() => {
    activeRun = null
  })

  return activeRun
}
