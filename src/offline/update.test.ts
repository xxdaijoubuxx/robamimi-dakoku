import { describe, expect, it } from 'vitest'
import { isUpdateReady } from './update'

describe('Service Worker更新', () => {
  it('旧版が動作中で新版のインストールが完了した場合だけ案内する', () => {
    expect(isUpdateReady('installed', true)).toBe(true)
    expect(isUpdateReady('installing', true)).toBe(false)
    expect(isUpdateReady('installed', false)).toBe(false)
  })
})
