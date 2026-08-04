import { describe, expect, it } from 'vitest'
import { csvExportFilename } from './download'

describe('CSVダウンロード', () => {
  it('端末の出力日をファイル名に含める', () => {
    const localDate = new Date(2026, 7, 4, 23, 59, 58)
    expect(csvExportFilename(localDate)).toBe('robamimi-dakoku-2026-08-04.csv')
  })
})
