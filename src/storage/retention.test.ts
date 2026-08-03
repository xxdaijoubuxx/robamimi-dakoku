import { describe, expect, it } from 'vitest'
import {
  isWithinRestoreWindow,
  RESTORE_WINDOW_MILLISECONDS,
} from './retention'

describe('削除済み記録の復元期間', () => {
  const now = Date.parse('2026-08-31T00:00:00.000Z')

  it('30日以内とちょうど30日は復元できる', () => {
    expect(isWithinRestoreWindow(new Date(now - 1_000).toISOString(), now)).toBe(true)
    expect(isWithinRestoreWindow(new Date(now - RESTORE_WINDOW_MILLISECONDS).toISOString(), now)).toBe(true)
  })

  it('30日を過ぎた記録、未削除、不正日時は復元対象にしない', () => {
    expect(isWithinRestoreWindow(new Date(now - RESTORE_WINDOW_MILLISECONDS - 1).toISOString(), now)).toBe(false)
    expect(isWithinRestoreWindow(null, now)).toBe(false)
    expect(isWithinRestoreWindow('invalid', now)).toBe(false)
  })
})
