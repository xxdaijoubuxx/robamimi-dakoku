import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface WebManifest {
  id: string
  scope: string
  short_name: string
  start_url: string
}

const entries = ['wake', 'sleep', 'memo', 'history'] as const
const manifests = entries.map((entry) => {
  const file = resolve(`public/manifests/${entry}.webmanifest`)
  return JSON.parse(readFileSync(file, 'utf8')) as WebManifest
})

describe('Web App Manifest', () => {
  it('四つの入口用Manifest IDが重複しない', () => {
    const ids = manifests.map((manifest) => manifest.id)
    expect(new Set(ids).size).toBe(entries.length)
  })

  it.each(entries)('%sの開始URLが専用入口を指す', (entry) => {
    const manifest = manifests.find((candidate) => candidate.id.endsWith(`/${entry}`))
    expect(manifest?.start_url).toBe(`/robamimi-dakoku/${entry}/`)
  })

  it.each(entries)('%sのscopeが専用入口だけを含む', (entry) => {
    const manifest = manifests.find((candidate) => candidate.id.endsWith(`/${entry}`))
    expect(manifest?.scope).toBe(`/robamimi-dakoku/${entry}/`)
  })

  it.each(entries)('%sがscope分離版のManifest URLを参照する', (entry) => {
    const html = readFileSync(resolve(`${entry}/index.html`), 'utf8')
    expect(html).toContain(`../manifests/${entry}.webmanifest?v=2`)
  })

  it('ホーム画面の短い表示名が区別できる', () => {
    expect(manifests.map((manifest) => manifest.short_name)).toEqual(['起床', '就寝', 'メモ', '履歴'])
  })
})
