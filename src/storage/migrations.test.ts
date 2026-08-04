import { describe, expect, it } from 'vitest'
import { createInitialSettings, DATA_VERSION, migratePrototypeRecord } from './migrations'
import type { PrototypeRecord } from '../prototype/types'

describe('端末内データ移行', () => {
  it('初期設定に端末IDとデータ形式版を保持する', () => {
    expect(createInitialSettings('device-1')).toEqual({
      key: 'main',
      ownerUid: null,
      deviceId: 'device-1',
      lastSyncAt: null,
      setupStage: 'not-started',
      shortcutsAdded: [],
      setupTestRecordId: null,
      dataVersion: DATA_VERSION,
    })
  })

  it('試作記録を本番形式へ補完し、元の時刻とIDを保つ', () => {
    const prototype: PrototypeRecord = {
      id: 'record-1',
      kind: 'memo',
      occurredAt: '2026-08-03T05:30:00.000Z',
      createdAt: '2026-08-03T05:30:00.000Z',
    }

    expect(migratePrototypeRecord(prototype, 'device-1', 'Asia/Tokyo')).toEqual({
      id: 'record-1',
      kind: 'memo',
      occurredAt: '2026-08-03T05:30:00.000Z',
      timezone: 'Asia/Tokyo',
      body: '',
      createdAt: '2026-08-03T05:30:00.000Z',
      updatedAt: '2026-08-03T05:30:00.000Z',
      revision: 1,
      deletedAt: null,
      deviceId: 'device-1',
    })
  })
})
