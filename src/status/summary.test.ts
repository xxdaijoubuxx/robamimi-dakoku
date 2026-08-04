import { describe, expect, it } from 'vitest'
import type { AppSettings, RecordData, SyncEntry, SyncStatus } from '../storage/types'
import { statusAttentionCount, summarizeAppStatus } from './summary'

const settings: AppSettings = {
  key: 'main', ownerUid: 'owner', deviceId: 'device', lastSyncAt: '2026-08-04T01:00:00.000Z',
  setupStage: 'complete', shortcutsAdded: [], setupTestRecordId: null, dataVersion: 2,
}

function record(id: string, deletedAt: string | null = null): RecordData {
  return {
    id, kind: 'memo', occurredAt: '2026-08-04T00:00:00.000Z', timezone: 'Asia/Tokyo', body: '',
    createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z', revision: 1,
    deletedAt, deviceId: 'device',
  }
}

function sync(recordId: string, status: SyncStatus): SyncEntry {
  return { recordId, status, syncedRevision: null, lastAttemptAt: null, errorCode: null, syncedRecord: null, remoteRecord: null }
}

describe('アプリ状態の集計', () => {
  it('有効記録と同期状態を本文なしの件数へまとめる', () => {
    const summary = summarizeAppStatus(
      [record('active'), record('deleted', '2026-08-04T01:00:00.000Z')],
      [sync('active', 'pending'), sync('deleted', 'failed'), sync('other', 'reauth-required'), sync('conflict', 'conflict')],
      settings,
    )
    expect(summary).toEqual({
      recordCount: 1, pendingCount: 1, failedCount: 1, reauthRequiredCount: 1, conflictCount: 1,
      lastSyncAt: settings.lastSyncAt, offlineReady: true,
    })
    expect(statusAttentionCount(summary)).toBe(4)
  })
})
