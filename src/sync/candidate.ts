import type { RecordData, SyncEntry } from '../storage/types'

export function isPendingNewRecord(record: RecordData, sync: SyncEntry | undefined): boolean {
  return record.deletedAt === null
    && sync?.syncedRevision === null
    && sync.status !== 'conflict'
}

export function isPendingChangedRecord(record: RecordData, sync: SyncEntry | undefined): sync is SyncEntry {
  return sync !== undefined
    && sync.syncedRevision !== null
    && record.revision > sync.syncedRevision
    && sync.status !== 'conflict'
}
