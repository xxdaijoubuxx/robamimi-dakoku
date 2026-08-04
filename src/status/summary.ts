import type { AppSettings, RecordData, SyncEntry } from '../storage/types'

export interface AppStatusSummary {
  recordCount: number
  pendingCount: number
  failedCount: number
  reauthRequiredCount: number
  conflictCount: number
  lastSyncAt: string | null
  offlineReady: boolean
  dataVersion: number
}

export function summarizeAppStatus(
  records: RecordData[],
  syncEntries: SyncEntry[],
  settings: AppSettings,
): AppStatusSummary {
  const count = (status: SyncEntry['status']) => syncEntries.filter((entry) => entry.status === status).length
  return {
    recordCount: records.filter((record) => record.deletedAt === null).length,
    pendingCount: count('pending'),
    failedCount: count('failed'),
    reauthRequiredCount: count('reauth-required'),
    conflictCount: count('conflict'),
    lastSyncAt: settings.lastSyncAt,
    offlineReady: settings.setupStage === 'offline-ready' || settings.setupStage === 'complete',
    dataVersion: settings.dataVersion,
  }
}

export function statusAttentionCount(summary: AppStatusSummary): number {
  return summary.pendingCount + summary.failedCount + summary.reauthRequiredCount + summary.conflictCount
}
