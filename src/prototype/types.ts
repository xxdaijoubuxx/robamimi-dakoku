import type { EntryKind } from '../storage/types'

export type { EntryKind }

export interface PrototypeRecord {
  id: string
  kind: EntryKind
  occurredAt: string
  createdAt: string
}
