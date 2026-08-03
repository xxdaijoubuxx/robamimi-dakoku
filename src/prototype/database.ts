import { openDB, type DBSchema } from 'idb'
import type { EntryKind, PrototypeRecord } from './types'

interface PrototypeDatabase extends DBSchema {
  records: {
    key: string
    value: PrototypeRecord
    indexes: { 'by-occurred-at': string }
  }
}

const databasePromise = openDB<PrototypeDatabase>('robamimi-dakoku-prototype', 1, {
  upgrade(database) {
    const records = database.createObjectStore('records', { keyPath: 'id' })
    records.createIndex('by-occurred-at', 'occurredAt')
  },
})

export async function createPrototypeRecord(kind: EntryKind): Promise<PrototypeRecord> {
  const occurredAt = new Date().toISOString()
  const record: PrototypeRecord = {
    id: crypto.randomUUID(),
    kind,
    occurredAt,
    createdAt: occurredAt,
  }
  const database = await databasePromise
  await database.add('records', record)
  return record
}

export async function getPrototypeRecords(): Promise<PrototypeRecord[]> {
  const database = await databasePromise
  const records = await database.getAllFromIndex('records', 'by-occurred-at')
  return records.reverse()
}

export async function deleteAllPrototypeRecords(): Promise<void> {
  const database = await databasePromise
  await database.clear('records')
}
