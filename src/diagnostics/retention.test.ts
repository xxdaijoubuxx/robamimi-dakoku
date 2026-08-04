import { describe, expect, it } from 'vitest'
import type { DiagnosticLog } from '../storage/types'
import { diagnosticIdsToDelete } from './retention'

function log(id: number, occurredAt: string): DiagnosticLog {
  return {
    id, occurredAt, appVersion: '0.1.0', operation: 'app-launch-history', outcome: 'success',
    errorCode: null, recordId: null,
  }
}

describe('診断ログ整理', () => {
  it('30日より古いログを削除対象にする', () => {
    const now = new Date('2026-08-04T00:00:00.000Z').getTime()
    expect(diagnosticIdsToDelete([
      log(1, '2026-07-05T00:00:00.000Z'),
      log(2, '2026-07-04T23:59:59.999Z'),
    ], now)).toEqual([2])
  })

  it('新しい順の500件を超えたログを削除対象にする', () => {
    const logs = Array.from({ length: 502 }, (_, index) => log(index + 1, new Date(Date.UTC(2026, 7, 4, 0, 0, index)).toISOString()))
    expect(diagnosticIdsToDelete(logs, new Date('2026-08-04T01:00:00.000Z').getTime())).toEqual([2, 1])
  })
})
