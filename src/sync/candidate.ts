import type { RecordData, SyncEntry } from '../storage/types'

export function isPendingNewRecord(record: RecordData, sync: SyncEntry | undefined): boolean {
  return record.deletedAt === null
    && sync?.syncedRevision === null
    && sync.status !== 'conflict'
}
