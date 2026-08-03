import { describe, expect, it } from 'vitest'
import type { EntryKind } from './types'

describe('試作記録の種類', () => {
  it.each<[EntryKind, string]>([
    ['wake', '起床'],
    ['sleep', '就寝'],
    ['memo', 'メモ'],
  ])('%sを固定値として扱える', (kind) => {
    expect(['wake', 'sleep', 'memo']).toContain(kind)
  })
})
