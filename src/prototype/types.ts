export type EntryKind = 'wake' | 'sleep' | 'memo'

export interface PrototypeRecord {
  id: string
  kind: EntryKind
  occurredAt: string
  createdAt: string
}
