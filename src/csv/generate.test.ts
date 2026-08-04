import { describe, expect, it } from 'vitest'
import type { RecordData } from '../storage/types'
import { generateRecordsCsv } from './generate'

function record(
  id: string,
  occurredAt: string,
  kind: RecordData['kind'],
  deletedAt: string | null = null,
  body = kind === 'memo' ? '頭痛' : '',
): RecordData {
  return { id, kind, occurredAt, timezone: 'Asia/Tokyo', body,
    createdAt: occurredAt, updatedAt: occurredAt, revision: 1, deletedAt, deviceId: 'device-1' }
}

describe('CSV生成', () => {
  it('UTF-8 BOM、見出し、全件を最新順で生成する', () => {
    const csv = generateRecordsCsv([
      record('old', '2026-08-02T22:12:00.000Z', 'wake'),
      record('new', '2026-08-03T14:48:00.000Z', 'sleep'),
    ])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"日時","種類","本文"')
    expect(csv.indexOf('2026-08-03 23:48:00 Asia/Tokyo')).toBeLessThan(csv.indexOf('2026-08-03 07:12:00 Asia/Tokyo'))
  })

  it('削除済み記録を含めない', () => {
    const csv = generateRecordsCsv([record('deleted', '2026-08-03T00:00:00.000Z', 'memo', '2026-08-04T00:00:00.000Z')])
    expect(csv).not.toContain('頭痛')
  })

  it('日本語とカンマを一つの本文フィールドとして出力する', () => {
    const csv = generateRecordsCsv([
      record('memo', '2026-08-03T00:00:00.000Z', 'memo', null, '頭痛,ではなく,肩こり'),
    ])
    expect(csv).toContain('"メモ","頭痛,ではなく,肩こり"\r\n')
  })

  it('半角の引用符を二重化する', () => {
    const csv = generateRecordsCsv([
      record('memo', '2026-08-03T00:00:00.000Z', 'memo', null, '薬を"半錠"飲んだ'),
    ])
    expect(csv).toContain('"メモ","薬を""半錠""飲んだ"\r\n')
  })

  it('本文内の改行を引用符の内側に保つ', () => {
    const csv = generateRecordsCsv([
      record('memo', '2026-08-03T00:00:00.000Z', 'memo', null, '一行目\n二行目\r\n三行目'),
    ])
    expect(csv).toContain('"メモ","一行目\n二行目\r\n三行目"\r\n')
  })

  it('日本語・カンマ・引用符・改行が同居しても壊さない', () => {
    const csv = generateRecordsCsv([
      record('memo', '2026-08-03T00:00:00.000Z', 'memo', null, '頭痛がした, "少し休む"\n水を飲んだ'),
    ])
    expect(csv).toContain('"メモ","頭痛がした, ""少し休む""\n水を飲んだ"\r\n')
  })
})
