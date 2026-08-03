import { describe, expect, it } from 'vitest'
import type { RecordData, SyncEntry } from '../storage/types'
import { isPendingNewRecord } from './candidate'

const record = { id: 'r1', deletedAt: null } as RecordData
const pending = { recordId: 'r1', status: 'pending', syncedRevision: null } as SyncEntry

describe('新規記録の再同期対象', () => {
  it('未送信の同期待ち・失敗・再ログイン状態を対象にする', () => {
    for (const status of ['pending', 'failed', 'reauth-required'] as const) {
      expect(isPendingNewRecord(record, { ...pending, status })).toBe(true)
    }
  })

  it('同期済み・競合・削除済みは新規送信の対象にしない', () => {
    expect(isPendingNewRecord(record, { ...pending, status: 'synced', syncedRevision: 1 })).toBe(false)
    expect(isPendingNewRecord(record, { ...pending, status: 'conflict' })).toBe(false)
    expect(isPendingNewRecord({ ...record, deletedAt: '2026-08-03T00:00:00Z' }, pending)).toBe(false)
  })
})
