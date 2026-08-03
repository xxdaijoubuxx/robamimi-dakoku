import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { OWNER_UID } from '../firebase/owner'
import type { RecordData } from '../storage/types'
import { firestoreRecord, recordDocumentPath } from './format'

const record: RecordData = {
  id: 'record-123', kind: 'memo', occurredAt: '2026-08-03T12:00:00.000Z', timezone: 'Asia/Tokyo',
  body: '頭痛がした', createdAt: '2026-08-03T12:00:00.000Z', updatedAt: '2026-08-03T12:01:00.000Z',
  revision: 2, deletedAt: null, deviceId: 'device-1',
}

describe('新規記録のFirebase送信形式', () => {
  it('端末内と同じ記録IDを文書IDに使う', () => {
    expect(recordDocumentPath(record.id)).toBe(`users/${OWNER_UID}/records/${record.id}`)
  })

  it('日時をFirestore Timestampへ変換し、IDを本文に重複保存しない', () => {
    const converted = firestoreRecord(record)
    expect(converted.occurredAt).toBeInstanceOf(Timestamp)
    expect(converted.createdAt).toBeInstanceOf(Timestamp)
    expect(converted.updatedAt).toBeInstanceOf(Timestamp)
    expect(converted).not.toHaveProperty('id')
    expect(converted.body).toBe('頭痛がした')
  })
})
