import { describe, expect, it } from 'vitest'
import type { DiagnosticLog } from '../storage/types'
import { createDiagnosticExport, diagnosticFilename } from './export'

describe('診断情報の保存', () => {
  it('本文や認証情報を受け取らず状態と許可済みログだけを生成する', () => {
    const log: DiagnosticLog = {
      id: 12, occurredAt: '2026-08-04T01:00:00.000Z', appVersion: '0.1.0',
      operation: 'memo-body-save', outcome: 'success', errorCode: null, recordId: 'record-1',
    }
    const result = createDiagnosticExport({
      recordCount: 3, pendingCount: 0, failedCount: 0, reauthRequiredCount: 0, conflictCount: 0,
      lastSyncAt: '2026-08-04T01:00:00.000Z', offlineReady: true, dataVersion: 2,
    }, [log], { online: true, googleLogin: 'active' }, new Date('2026-08-04T02:00:00.000Z'))
    expect(result.logs[0]).not.toHaveProperty('id')
    expect(Object.keys(result.logs[0] ?? {})).toEqual([
      'occurredAt', 'appVersion', 'operation', 'outcome', 'errorCode', 'recordId',
    ])
    expect(result).not.toHaveProperty('body')
    expect(result.runtime).not.toHaveProperty('token')
    expect(result.dataVersion).toBe(2)
  })

  it('端末の生成日をファイル名に含める', () => {
    expect(diagnosticFilename(new Date(2026, 7, 4))).toBe('robamimi-diagnostics-2026-08-04.json')
  })
})
