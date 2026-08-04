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
export type ShortcutKind = 'wake' | 'sleep' | 'memo' | 'history'

export interface AppSettings {
  key: 'main'
  ownerUid: string | null
  deviceId: string
  lastSyncAt: string | null
  setupStage: SetupStage
  shortcutsAdded: ShortcutKind[]
  setupTestRecordId: string | null
  dataVersion: number
}

export type DiagnosticOutcome = 'success' | 'failure'

export type DiagnosticOperation =
  | 'app-launch-setup' | 'app-launch-wake' | 'app-launch-sleep' | 'app-launch-memo' | 'app-launch-history'
  | 'local-record-save' | 'local-record-delete' | 'local-record-restore' | 'memo-body-save'
  | 'sync-run-start' | 'sync-run' | 'sync-record' | 'google-sign-in' | 'google-sign-out'
  | 'conflict-detected' | 'conflict-resolved' | 'csv-export' | 'diagnostics-export'
  | 'offline-readiness' | 'service-worker-register' | 'service-worker-update-ready'

export interface DiagnosticLog {
  id?: number
  occurredAt: string
  appVersion: string
  operation: DiagnosticOperation
  outcome: DiagnosticOutcome
  errorCode: string | null
  recordId: string | null
}
