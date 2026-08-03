import { Timestamp } from 'firebase/firestore'
import { OWNER_UID } from '../firebase/owner'
import type { RecordData } from '../storage/types'

export function recordDocumentPath(recordId: string): string {
  return `users/${OWNER_UID}/records/${recordId}`
}

export function firestoreRecord(record: RecordData) {
  return {
    kind: record.kind,
    occurredAt: Timestamp.fromDate(new Date(record.occurredAt)),
    timezone: record.timezone,
    body: record.body,
    createdAt: Timestamp.fromDate(new Date(record.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(record.updatedAt)),
    revision: record.revision,
    deletedAt: record.deletedAt === null ? null : Timestamp.fromDate(new Date(record.deletedAt)),
    deviceId: record.deviceId,
  }
}
