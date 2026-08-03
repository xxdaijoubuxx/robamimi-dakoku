import { describe, expect, it } from 'vitest'
import { firebaseConfig } from './config'

describe('Firebase Web設定', () => {
  it('ろばみみ打刻のFirebaseプロジェクトを指す', () => {
    expect(firebaseConfig.projectId).toBe('robamimi-dakoku')
    expect(firebaseConfig.authDomain).toBe('robamimi-dakoku.firebaseapp.com')
  })

  it('Webアプリ識別子を持つ', () => {
    expect(firebaseConfig.appId).toMatch(/^1:86443504481:web:/)
  })
})
