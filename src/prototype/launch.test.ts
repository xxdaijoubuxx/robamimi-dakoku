import { describe, expect, it } from 'vitest'
import { completedLaunchUrl, launchMode } from './launch'

describe('ショートカット起動', () => {
  it('準備URLでは記録しない', () => {
    expect(launchMode('?install=1')).toBe('prepare')
  })

  it('記録済みURLの再読み込みでは記録しない', () => {
    expect(launchMode('?done=1')).toBe('completed')
  })

  it('ショートカットの入口URLでは記録する', () => {
    expect(launchMode('')).toBe('record')
  })

  it('記録後は同じ種類の記録済みURLへ切り替える', () => {
    expect(completedLaunchUrl('/robamimi-dakoku/', 'wake')).toBe('/robamimi-dakoku/wake/?done=1')
  })
})
