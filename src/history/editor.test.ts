import { describe, expect, it } from 'vitest'
import { draftFromRecord, isoToLocalDateTime, localDateTimeToIso } from './editor'
import type { RecordData } from '../storage/types'

describe('履歴編集', () => {
  it('現在の端末タイムゾーンでdatetime-localとISO日時を往復する', () => {
    const original = '2026-08-03T05:23:00.000Z'
    const local = isoToLocalDateTime(original)

    expect(localDateTimeToIso(local)).toBe(original)
  })

  it('編集案に種類・日時・本文を取り出す', () => {
    const record: RecordData = {
      id: 'record-1',
      kind: 'memo',
      occurredAt: '2026-08-03T05:23:00.000Z',
      timezone: 'Asia/Tokyo',
      body: '頭痛がした',
      createdAt: '2026-08-03T05:23:00.000Z',
      updatedAt: '2026-08-03T05:23:00.000Z',
      revision: 1,
      deletedAt: null,
      deviceId: 'device-1',
    }

    expect(draftFromRecord(record)).toEqual({
      kind: 'memo',
      localDateTime: isoToLocalDateTime(record.occurredAt),
      body: '頭痛がした',
    })
  })
})
