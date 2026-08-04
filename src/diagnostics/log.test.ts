import { describe, expect, it } from 'vitest'
import { createDiagnosticLog, safeErrorCode } from './model'

describe('端末内診断ログ', () => {
  it('許可済みの管理情報だけでログを作る', () => {
    expect(createDiagnosticLog('memo-body-save', 'success', {
      occurredAt: '2026-08-04T01:00:00.000Z', recordId: 'record-1',
    })).toEqual({
      occurredAt: '2026-08-04T01:00:00.000Z', appVersion: '0.1.4', operation: 'memo-body-save',
      outcome: 'success', errorCode: null, recordId: 'record-1',
    })
  })

  it('エラー本文を保存せず安全なコードだけを採用する', () => {
    expect(safeErrorCode({ code: 'permission-denied', message: '秘密を含む本文' }, 'unknown')).toBe('permission-denied')
    expect(safeErrorCode({ code: '本文: 秘密' }, 'unknown')).toBe('unknown')
  })
})
