import { describe, expect, it } from 'vitest'
import { failedSyncStatus, firebaseErrorCode } from './error'

describe('Firebase同期エラーの分類', () => {
  it.each(['auth/invalid-user-token', 'auth/user-token-expired', 'permission-denied', 'unauthenticated'])(
    '%sは再ログインが必要な状態にする',
    (code) => expect(failedSyncStatus({ code })).toBe('reauth-required'),
  )

  it('通信不能は同期失敗にする', () => {
    expect(failedSyncStatus({ code: 'unavailable' })).toBe('failed')
  })

  it('Firestore接頭辞を保存用コードから除く', () => {
    expect(firebaseErrorCode({ code: 'firestore/permission-denied' })).toBe('permission-denied')
  })
})
