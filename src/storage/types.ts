export type EntryKind = 'wake' | 'sleep' | 'memo'

export interface RecordData {
  id: string
  kind: EntryKind
  occurredAt: string
  timezone: string
  body: string
  createdAt: string
  updatedAt: string
  revision: number
  deletedAt: string | null
  deviceId: string
}

export type SyncStatus = 'pending' | 'synced' | 'failed' | 'reauth-required' | 'conflict'

export interface SyncEntry {
  recordId: string
  status: SyncStatus
  syncedRevision: number | null
  lastAttemptAt: string | null
  errorCode: string | null
  syncedRecord: RecordData | null
  remoteRecord: RecordData | null
}

export interface HistoryEntry {
  record: RecordData
  syncStatus: SyncStatus
}

export type SetupStage = 'not-started' | 'authenticated' | 'offline-ready' | 'complete'

export interface AppSettings {
  key: 'main'
  ownerUid: string | null
  deviceId: string
  lastSyncAt: string | null
  setupStage: SetupStage
  dataVersion: number
}

export type DiagnosticOutcome = 'success' | 'failure'

export interface DiagnosticLog {
  id?: number
  occurredAt: string
  appVersion: string
  operation: string
  outcome: DiagnosticOutcome
  errorCode: string | null
  recordId: string | null
}
