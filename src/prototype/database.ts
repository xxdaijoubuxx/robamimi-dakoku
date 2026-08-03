import {
  createRecord,
  deleteAllPrototypeData,
  getRecordsNewestFirst,
  hasPreviousRecordWithin,
} from '../storage/database'
import type { EntryKind, PrototypeRecord } from './types'
import type { RecordData } from '../storage/types'

export async function createPrototypeRecord(kind: EntryKind): Promise<RecordData> {
  return createRecord(kind)
}

export async function getPrototypeRecords(): Promise<RecordData[]> {
  return getRecordsNewestFirst()
}

export async function deleteAllPrototypeRecords(): Promise<void> {
  return deleteAllPrototypeData()
}

export { hasPreviousRecordWithin }

export type { PrototypeRecord }
