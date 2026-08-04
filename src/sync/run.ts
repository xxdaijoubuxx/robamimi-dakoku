import { getPendingChangedRecords, getPendingNewRecords } from '../storage/database'
import { uploadNewRecord, type UploadOutcome } from './upload'
import { downloadRemoteRecords } from './download'
import { uploadChangedRecord } from './change'
import { safeErrorCode, writeDiagnosticLog } from '../diagnostics/log'

export interface SyncRunResult {
  total: number
  outcomes: Record<UploadOutcome, number>
  downloaded: number
  changed: number
}

let activeRun: Promise<SyncRunResult> | null = null
let rerunRequested = false

export function syncPendingNewRecords(): Promise<SyncRunResult> {
  if (activeRun) {
    rerunRequested = true
    return activeRun
  }

  activeRun = (async () => {
    await writeDiagnosticLog('sync-run-start', 'success')
    const result: SyncRunResult = {
      total: 0,
      outcomes: { synced: 0, pending: 0, failed: 0, 'reauth-required': 0 },
      downloaded: 0,
      changed: 0,
    }
    do {
      rerunRequested = false
      const records = await getPendingNewRecords()
      for (const record of records) result.outcomes[await uploadNewRecord(record)] += 1
      const changedRecords = await getPendingChangedRecords()
      for (const item of changedRecords) await uploadChangedRecord(item.record, item.sync)
      const downloaded = await downloadRemoteRecords()
      result.total += records.length + changedRecords.length + downloaded
      result.downloaded += downloaded
      result.changed += changedRecords.length
    } while (rerunRequested)
    await writeDiagnosticLog('sync-run', 'success')
    return result
  })().catch(async (error: unknown) => {
    await writeDiagnosticLog('sync-run', 'failure', { errorCode: safeErrorCode(error, 'sync-failed') })
    throw error
  }).finally(() => {
    activeRun = null
  })

  return activeRun
}
