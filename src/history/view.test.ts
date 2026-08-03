import { describe, expect, it } from 'vitest'
import { groupHistoryEntries, historyDateKey, historyTimeLabel } from './view'
import type { HistoryEntry, RecordData, SyncStatus } from '../storage/types'

function historyEntry(
  id: string,
  occurredAt: string,
  timezone = 'Asia/Tokyo',
  syncStatus: SyncStatus = 'pending',
): HistoryEntry {
  const record: RecordData = {
    id,
    kind: 'memo',
    occurredAt,
    timezone,
    body: '',
    createdAt: occurredAt,
    updatedAt: occurredAt,
    revision: 1,
    deletedAt: null,
    deviceId: 'device-1',
  }
  return { record, syncStatus }
}

describe('履歴表示', () => {
  it('打刻時のタイムゾーンで日付と時刻を表示する', () => {
    const isoDate = '2026-08-02T15:30:00.000Z'

    expect(historyDateKey(isoDate, 'Asia/Tokyo')).toBe('2026-08-03')
    expect(historyTimeLabel(isoDate, 'Asia/Tokyo')).toBe('00:30')
    expect(historyDateKey(isoDate, 'UTC')).toBe('2026-08-02')
  })

  it('新しい順の入力を崩さず、同じ現地日付ごとにまとめる', () => {
    const entries = [
      historyEntry('newest', '2026-08-03T05:00:00.000Z'),
      historyEntry('same-day', '2026-08-02T23:00:00.000Z'),
      historyEntry('previous-day', '2026-08-02T10:00:00.000Z'),
    ]

    const groups = groupHistoryEntries(entries)

    expect(groups).toHaveLength(2)
    expect(groups[0]?.entries.map((entry) => entry.record.id)).toEqual(['newest', 'same-day'])
    expect(groups[1]?.entries.map((entry) => entry.record.id)).toEqual(['previous-day'])
  })
})
