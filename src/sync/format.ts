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

export function recordFromFirestore(id: string, data: Record<string, unknown>): RecordData {
  const timestamp = (value: unknown, field: string): string => {
    if (!(value instanceof Timestamp)) throw new Error(`${field}が日時ではありません。`)
    return value.toDate().toISOString()
  }
  if (!['wake', 'sleep', 'memo'].includes(data.kind as string)) throw new Error('kindが不正です。')
  for (const field of ['timezone', 'body', 'deviceId'] as const) {
    if (typeof data[field] !== 'string') throw new Error(`${field}が文字列ではありません。`)
  }
  if (!Number.isInteger(data.revision) || (data.revision as number) < 1) throw new Error('revisionが不正です。')
  if (data.deletedAt !== null && !(data.deletedAt instanceof Timestamp)) throw new Error('deletedAtが不正です。')
  return {
    id,
    kind: data.kind as RecordData['kind'],
    occurredAt: timestamp(data.occurredAt, 'occurredAt'),
    timezone: data.timezone as string,
    body: data.body as string,
    createdAt: timestamp(data.createdAt, 'createdAt'),
    updatedAt: timestamp(data.updatedAt, 'updatedAt'),
    revision: data.revision as number,
    deletedAt: data.deletedAt === null ? null : timestamp(data.deletedAt, 'deletedAt'),
    deviceId: data.deviceId as string,
  }
}
