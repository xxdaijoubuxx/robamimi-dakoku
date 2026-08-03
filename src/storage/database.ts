import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createInitialSettings, DATA_VERSION, migratePrototypeRecord } from './migrations'
import type { AppSettings, DiagnosticLog, EntryKind, RecordData, SyncEntry, SyncStatus } from './types'
import type { PrototypeRecord } from '../prototype/types'

const DATABASE_NAME = 'robamimi-dakoku-prototype'

interface RobamimiDatabase extends DBSchema {
  records: {
    key: string
    value: RecordData | PrototypeRecord
    indexes: { 'by-occurred-at': string }
  }
  sync: {
    key: string
    value: SyncEntry
    indexes: { 'by-status': SyncStatus }
  }
  settings: {
    key: 'main'
    value: AppSettings
  }
  diagnostics: {
    key: number
    value: DiagnosticLog
    indexes: { 'by-occurred-at': string }
  }
}

function currentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function pendingSyncEntry(recordId: string): SyncEntry {
  return {
    recordId,
    status: 'pending',
    syncedRevision: null,
    lastAttemptAt: null,
    errorCode: null,
    syncedRecord: null,
    remoteRecord: null,
  }
}

function isCurrentRecord(record: RecordData | PrototypeRecord): record is RecordData {
  return 'revision' in record && 'deviceId' in record
}

async function migrateVersionOneData(database: IDBPDatabase<RobamimiDatabase>): Promise<void> {
  const transaction = database.transaction(['records', 'sync', 'settings'], 'readwrite')
  let settings = await transaction.objectStore('settings').get('main')
  if (!settings) {
    settings = createInitialSettings(crypto.randomUUID())
    await transaction.objectStore('settings').put(settings)
  }

  let cursor = await transaction.objectStore('records').openCursor()
  while (cursor) {
    if (!isCurrentRecord(cursor.value)) {
      const migrated = migratePrototypeRecord(cursor.value, settings.deviceId, currentTimezone())
      await cursor.update(migrated)
      await transaction.objectStore('sync').put(pendingSyncEntry(migrated.id))
    }
    cursor = await cursor.continue()
  }

  await transaction.done
}

const databasePromise = openDB<RobamimiDatabase>(DATABASE_NAME, DATA_VERSION, {
  upgrade(database, oldVersion, _newVersion, transaction) {
    if (oldVersion < 1) {
      const records = database.createObjectStore('records', { keyPath: 'id' })
      records.createIndex('by-occurred-at', 'occurredAt')
    }

    if (oldVersion < 2) {
      const sync = database.createObjectStore('sync', { keyPath: 'recordId' })
      sync.createIndex('by-status', 'status')
      database.createObjectStore('settings', { keyPath: 'key' })
      const diagnostics = database.createObjectStore('diagnostics', {
        keyPath: 'id',
        autoIncrement: true,
      })
      diagnostics.createIndex('by-occurred-at', 'occurredAt')

      if (oldVersion === 1 && !transaction.objectStore('records').indexNames.contains('by-occurred-at')) {
        transaction.objectStore('records').createIndex('by-occurred-at', 'occurredAt')
      }
    }
  },
})

const readyDatabasePromise = databasePromise.then(async (database) => {
  await migrateVersionOneData(database)
  return database
})

export async function createRecord(kind: EntryKind): Promise<RecordData> {
  const database = await readyDatabasePromise
  const settings = await database.get('settings', 'main')
  if (!settings) {
    throw new Error('端末設定が初期化されていません。')
  }

  const occurredAt = new Date().toISOString()
  const record: RecordData = {
    id: crypto.randomUUID(),
    kind,
    occurredAt,
    timezone: currentTimezone(),
    body: '',
    createdAt: occurredAt,
    updatedAt: occurredAt,
    revision: 1,
    deletedAt: null,
    deviceId: settings.deviceId,
  }

  const transaction = database.transaction(['records', 'sync'], 'readwrite')
  await transaction.objectStore('records').add(record)
  await transaction.objectStore('sync').add(pendingSyncEntry(record.id))
  await transaction.done
  return record
}

export async function getRecordsNewestFirst(): Promise<RecordData[]> {
  const database = await readyDatabasePromise
  const records = await database.getAllFromIndex('records', 'by-occurred-at')
  return records.filter(isCurrentRecord).reverse()
}

export async function hasPreviousRecordWithin(
  record: RecordData,
  intervalMilliseconds: number,
): Promise<boolean> {
  const records = await getRecordsNewestFirst()
  const occurredAt = new Date(record.occurredAt).getTime()

  return records.some((candidate) => {
    if (candidate.id === record.id || candidate.kind !== record.kind || candidate.deletedAt !== null) {
      return false
    }
    const difference = occurredAt - new Date(candidate.occurredAt).getTime()
    return difference >= 0 && difference <= intervalMilliseconds
  })
}

export async function updateMemoBody(recordId: string, body: string): Promise<RecordData> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync'], 'readwrite')
  const storedRecord = await transaction.objectStore('records').get(recordId)
  if (!storedRecord || !isCurrentRecord(storedRecord) || storedRecord.kind !== 'memo') {
    throw new Error('更新するメモが見つかりません。')
  }
  if (storedRecord.body === body) {
    await transaction.done
    return storedRecord
  }

  const updatedRecord: RecordData = {
    ...storedRecord,
    body,
    updatedAt: new Date().toISOString(),
    revision: storedRecord.revision + 1,
  }
  const currentSync = await transaction.objectStore('sync').get(recordId)
  const updatedSync: SyncEntry = {
    ...(currentSync ?? pendingSyncEntry(recordId)),
    status: currentSync?.status === 'conflict' ? 'conflict' : 'pending',
    lastAttemptAt: null,
    errorCode: null,
  }

  await transaction.objectStore('records').put(updatedRecord)
  await transaction.objectStore('sync').put(updatedSync)
  await transaction.done
  return updatedRecord
}

export async function deleteAllPrototypeData(): Promise<void> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync'], 'readwrite')
  await transaction.objectStore('records').clear()
  await transaction.objectStore('sync').clear()
  await transaction.done
}
