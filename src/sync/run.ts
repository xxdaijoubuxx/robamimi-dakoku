import { getPendingNewRecords } from '../storage/database'
import { uploadNewRecord, type UploadOutcome } from './upload'
import { downloadRemoteRecords } from './download'

export interface SyncRunResult {
  total: number
  outcomes: Record<UploadOutcome, number>
  downloaded: number
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
    const downloaded = await downloadRemoteRecords()
    return { total: records.length + downloaded, outcomes, downloaded }
  })().finally(() => {
    activeRun = null
  })

  return activeRun
}
