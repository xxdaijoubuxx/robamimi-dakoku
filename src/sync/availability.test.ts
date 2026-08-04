import { describe, expect, it } from 'vitest'
import { canAttemptSync } from './availability'

describe('同期の開始可否', () => {
  it('オンラインなら同期を開始できる', () => {
    expect(canAttemptSync(true)).toBe(true)
  })

  it('圏外ならFirebaseを待たず同期待ちを維持する', () => {
    expect(canAttemptSync(false)).toBe(false)
  })
})
