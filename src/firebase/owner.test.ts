import { describe, expect, it } from 'vitest'
import { OWNER_UID, isOwnerUid } from './owner'

describe('本人UID', () => {
  it('確認済み本人だけを許可する', () => {
    expect(isOwnerUid(OWNER_UID)).toBe(true)
  })

  it('別UIDを拒否する', () => {
    expect(isOwnerUid('another-user')).toBe(false)
  })
})
