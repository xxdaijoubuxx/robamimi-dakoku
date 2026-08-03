import { describe, expect, it } from 'vitest'
import { OWNER_UID } from '../firebase/owner'
import { createInitialSettings } from '../storage/migrations'
import { authenticateDevice, isDailyUseConfigured } from './device'

describe('端末の本人確認', () => {
  it('未設定の端末では日常画面を許可しない', () => {
    expect(isDailyUseConfigured(createInitialSettings('device-1'))).toBe(false)
  })

  it('本人UIDを確認済みとして保存する', () => {
    const settings = authenticateDevice(createInitialSettings('device-1'), OWNER_UID)

    expect(settings.ownerUid).toBe(OWNER_UID)
    expect(settings.setupStage).toBe('authenticated')
    expect(isDailyUseConfigured(settings)).toBe(true)
  })

  it('別UIDを本人として保存しない', () => {
    expect(() => authenticateDevice(createInitialSettings('device-1'), 'another-user')).toThrow(
      '本人UIDと一致しません。',
    )
  })

  it('後続の初回設定段階を認証済みへ戻さない', () => {
    const settings = {
      ...createInitialSettings('device-1'),
      ownerUid: OWNER_UID,
      setupStage: 'complete' as const,
    }

    expect(authenticateDevice(settings, OWNER_UID).setupStage).toBe('complete')
  })
})
