import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createInitialSettings, DATA_VERSION, migratePrototypeRecord } from './migrations'
import { isWithinRestoreWindow } from './retention'
import type {
  AppSettings,
  DiagnosticLog,
  EntryKind,
  HistoryEntry,
  RecordData,
  SyncEntry,
  SyncStatus,
  ShortcutKind,
} from './types'
import type { PrototypeRecord } from '../prototype/types'
import { authenticateDevice, markDeviceOfflineReady } from '../auth/device'
import { isPendingChangedRecord, isPendingNewRecord } from '../sync/candidate'
import { summarizeAppStatus, type AppStatusSummary } from '../status/summary'

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

export async function getAppSettings(): Promise<AppSettings> {
  const database = await readyDatabasePromise
  const settings = await database.get('settings', 'main')
  if (!settings) {
    throw new Error('端末設定が初期化されていません。')
  }
  if (!Array.isArray(settings.shortcutsAdded) || !('setupTestRecordId' in settings)) {
    const migrated = {
      ...settings,
      shortcutsAdded: Array.isArray(settings.shortcutsAdded) ? settings.shortcutsAdded : [],
      setupTestRecordId: 'setupTestRecordId' in settings ? settings.setupTestRecordId : null,
    }
    await database.put('settings', migrated)
    return migrated
  }
  return settings
}

export async function saveSetupTestRecord(recordId: string): Promise<void> {
  const database = await readyDatabasePromise
  const settings = await getAppSettings()
  await database.put('settings', { ...settings, setupTestRecordId: recordId })
}

export async function getSetupTestState(): Promise<{ record: RecordData; status: SyncStatus } | null> {
  const database = await readyDatabasePromise
  const settings = await getAppSettings()
  if (!settings.setupTestRecordId) return null
  const transaction = database.transaction(['records', 'sync'])
  const record = await transaction.objectStore('records').get(settings.setupTestRecordId)
  const sync = await transaction.objectStore('sync').get(settings.setupTestRecordId)
  await transaction.done
  return record && isCurrentRecord(record) ? { record, status: sync?.status ?? 'pending' } : null
}

export async function completeSetupTest(): Promise<void> {
  const database = await readyDatabasePromise
  const settings = await getAppSettings()
  await database.put('settings', { ...settings, setupTestRecordId: null, setupStage: 'complete' })
}

export async function saveShortcutAdded(shortcut: ShortcutKind): Promise<AppSettings> {
  const database = await readyDatabasePromise
  const settings = await getAppSettings()
  const shortcutsAdded = settings.shortcutsAdded.includes(shortcut)
    ? settings.shortcutsAdded
    : [...settings.shortcutsAdded, shortcut]
  const updated = { ...settings, shortcutsAdded }
  await database.put('settings', updated)
  return updated
}

export async function saveAuthenticatedOwner(uid: string): Promise<AppSettings> {
  const database = await readyDatabasePromise
  const settings = await getAppSettings()
  const authenticated = authenticateDevice(settings, uid)
  await database.put('settings', authenticated)
  return authenticated
}

export async function saveOfflineReady(): Promise<AppSettings> {
  const database = await readyDatabasePromise
  const ready = markDeviceOfflineReady(await getAppSettings())
  await database.put('settings', ready)
  return ready
}

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

export async function getHistoryEntries(): Promise<HistoryEntry[]> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync'])
  const records = await transaction.objectStore('records').index('by-occurred-at').getAll()
  const syncEntries = await transaction.objectStore('sync').getAll()
  await transaction.done

  const syncByRecordId = new Map(syncEntries.map((entry) => [entry.recordId, entry.status]))
  return records
    .filter(isCurrentRecord)
    .filter((record) => record.deletedAt === null)
    .reverse()
    .map((record) => ({
      record,
      syncStatus: syncByRecordId.get(record.id) ?? 'pending',
    }))
}

export async function getAppStatusSummary(): Promise<AppStatusSummary> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync', 'settings'])
  const records = await transaction.objectStore('records').getAll()
  const syncEntries = await transaction.objectStore('sync').getAll()
  const settings = await transaction.objectStore('settings').get('main')
  await transaction.done
  if (!settings) throw new Error('端末設定が見つかりません。')
  return summarizeAppStatus(records.filter(isCurrentRecord), syncEntries, settings)
}

export async function getPendingNewRecords(): Promise<RecordData[]> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync'])
  const records = await transaction.objectStore('records').getAll()
  const syncEntries = await transaction.objectStore('sync').getAll()
  await transaction.done
  const syncByRecordId = new Map(syncEntries.map((entry) => [entry.recordId, entry]))
  return records
    .filter(isCurrentRecord)
    .filter((record) => isPendingNewRecord(record, syncByRecordId.get(record.id)))
}

export async function getPendingChangedRecords(): Promise<Array<{ record: RecordData; sync: SyncEntry }>> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync'])
  const records = await transaction.objectStore('records').getAll()
  const entries = await transaction.objectStore('sync').getAll()
  await transaction.done
  const byId = new Map(entries.map((entry) => [entry.recordId, entry]))
  return records.filter(isCurrentRecord).flatMap((record) => {
    const sync = byId.get(record.id)
    return isPendingChangedRecord(record, sync) ? [{ record, sync }] : []
  })
}

export async function markRecordConflict(recordId: string, remoteRecord: RecordData): Promise<void> {
  const database = await readyDatabasePromise
  const transaction = database.transaction('sync', 'readwrite')
  const sync = await transaction.store.get(recordId)
  if (sync) await transaction.store.put({ ...sync, status: 'conflict', remoteRecord, errorCode: 'remote-changed' })
  await transaction.done
}

export async function getRecordConflict(recordId: string): Promise<{ local: RecordData; remote: RecordData } | null> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync'])
  const local = await transaction.objectStore('records').get(recordId)
  const sync = await transaction.objectStore('sync').get(recordId)
  await transaction.done
  if (!local || !isCurrentRecord(local) || sync?.status !== 'conflict' || !sync.remoteRecord) return null
  return { local, remote: sync.remoteRecord }
}

export async function resolveRecordConflict(recordId: string, choice: 'local' | 'remote'): Promise<void> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync'], 'readwrite')
  const local = await transaction.objectStore('records').get(recordId)
  const sync = await transaction.objectStore('sync').get(recordId)
  if (!local || !isCurrentRecord(local) || sync?.status !== 'conflict' || !sync.remoteRecord) {
    throw new Error('解決する競合が見つかりません。')
  }
  const remote = sync.remoteRecord
  if (choice === 'remote') {
    await transaction.objectStore('records').put(remote)
    await transaction.objectStore('sync').put({
      ...sync, status: 'synced', syncedRevision: remote.revision, syncedRecord: remote,
      remoteRecord: null, errorCode: null, lastAttemptAt: new Date().toISOString(),
    })
  } else {
    const resolved = {
      ...local,
      revision: Math.max(local.revision, remote.revision) + 1,
      updatedAt: new Date().toISOString(),
    }
    await transaction.objectStore('records').put(resolved)
    await transaction.objectStore('sync').put({
      ...sync, status: 'pending', syncedRevision: remote.revision, syncedRecord: remote,
      remoteRecord: null, errorCode: null,
    })
  }
  await transaction.done
}

export async function importRemoteRecords(records: RecordData[]): Promise<number> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync', 'settings'], 'readwrite')
  let imported = 0
  for (const record of records) {
    const existing = await transaction.objectStore('records').get(record.id)
    if (existing) continue
    await transaction.objectStore('records').add(record)
    await transaction.objectStore('sync').put({
      recordId: record.id,
      status: 'synced',
      syncedRevision: record.revision,
      lastAttemptAt: new Date().toISOString(),
      errorCode: null,
      syncedRecord: record,
      remoteRecord: null,
    })
    imported += 1
  }
  const settings = await transaction.objectStore('settings').get('main')
  if (settings) await transaction.objectStore('settings').put({ ...settings, lastSyncAt: new Date().toISOString() })
  await transaction.done
  return imported
}

export async function markRecordSynced(uploadedRecord: RecordData): Promise<boolean> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync', 'settings'], 'readwrite')
  const currentRecord = await transaction.objectStore('records').get(uploadedRecord.id)
  const currentSync = await transaction.objectStore('sync').get(uploadedRecord.id)

  if (!currentRecord || !isCurrentRecord(currentRecord) || currentRecord.revision !== uploadedRecord.revision) {
    await transaction.done
    return false
  }

  const syncedAt = new Date().toISOString()
  await transaction.objectStore('sync').put({
    ...(currentSync ?? pendingSyncEntry(uploadedRecord.id)),
    status: 'synced',
    syncedRevision: uploadedRecord.revision,
    lastAttemptAt: syncedAt,
    errorCode: null,
    syncedRecord: uploadedRecord,
    remoteRecord: null,
  })
  const settings = await transaction.objectStore('settings').get('main')
  if (settings) {
    await transaction.objectStore('settings').put({ ...settings, lastSyncAt: syncedAt })
  }
  await transaction.done
  return true
}

export async function markRecordSyncIssue(
  recordId: string,
  status: Extract<SyncStatus, 'failed' | 'reauth-required'>,
  errorCode: string,
): Promise<void> {
  const database = await readyDatabasePromise
  const transaction = database.transaction('sync', 'readwrite')
  const currentSync = await transaction.store.get(recordId)
  await transaction.store.put({
    ...(currentSync ?? pendingSyncEntry(recordId)),
    status,
    lastAttemptAt: new Date().toISOString(),
    errorCode,
  })
  await transaction.done
}

export async function getRecordById(recordId: string): Promise<RecordData | null> {
  const database = await readyDatabasePromise
  const record = await database.get('records', recordId)
  return record && isCurrentRecord(record) && record.deletedAt === null ? record : null
}

export async function getRecentlyDeletedRecords(nowMilliseconds = Date.now()): Promise<RecordData[]> {
  const database = await readyDatabasePromise
  const records = await database.getAll('records')
  return records
    .filter(isCurrentRecord)
    .filter((record) => isWithinRestoreWindow(record.deletedAt, nowMilliseconds))
    .sort((left, right) => (right.deletedAt ?? '').localeCompare(left.deletedAt ?? ''))
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

export type RecordChanges = Partial<Pick<RecordData, 'kind' | 'occurredAt' | 'timezone' | 'body'>>

export async function updateRecord(recordId: string, changes: RecordChanges): Promise<RecordData> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync'], 'readwrite')
  const storedRecord = await transaction.objectStore('records').get(recordId)
  if (!storedRecord || !isCurrentRecord(storedRecord) || storedRecord.deletedAt !== null) {
    throw new Error('更新する記録が見つかりません。')
  }
  const updatedValues = { ...storedRecord, ...changes }
  if (!['wake', 'sleep', 'memo'].includes(updatedValues.kind)) {
    throw new Error('記録の種類が不正です。')
  }
  if (updatedValues.kind !== 'memo' && updatedValues.body !== '') {
    throw new Error('起床と就寝にはメモ本文を保存できません。')
  }
  if (Number.isNaN(new Date(updatedValues.occurredAt).getTime()) || updatedValues.timezone === '') {
    throw new Error('記録の日時が不正です。')
  }
  if (
    storedRecord.kind === updatedValues.kind
    && storedRecord.occurredAt === updatedValues.occurredAt
    && storedRecord.timezone === updatedValues.timezone
    && storedRecord.body === updatedValues.body
  ) {
    await transaction.done
    return storedRecord
  }

  const updatedRecord: RecordData = {
    ...updatedValues,
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

export async function updateMemoBody(recordId: string, body: string): Promise<RecordData> {
  return updateRecord(recordId, { body })
}

async function changeDeletedAt(recordId: string, deletedAt: string | null): Promise<RecordData> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync'], 'readwrite')
  const storedRecord = await transaction.objectStore('records').get(recordId)
  if (!storedRecord || !isCurrentRecord(storedRecord)) {
    throw new Error('対象の記録が見つかりません。')
  }

  const updatedRecord: RecordData = {
    ...storedRecord,
    deletedAt,
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

export async function softDeleteRecord(recordId: string): Promise<RecordData> {
  const record = await getRecordById(recordId)
  if (!record) {
    throw new Error('削除する記録が見つかりません。')
  }
  return changeDeletedAt(recordId, new Date().toISOString())
}

export async function restoreRecord(recordId: string): Promise<RecordData> {
  const database = await readyDatabasePromise
  const storedRecord = await database.get('records', recordId)
  if (!storedRecord || !isCurrentRecord(storedRecord) || !isWithinRestoreWindow(storedRecord.deletedAt)) {
    throw new Error('この記録は復元できません。')
  }
  return changeDeletedAt(recordId, null)
}

export async function deleteAllPrototypeData(): Promise<void> {
  const database = await readyDatabasePromise
  const transaction = database.transaction(['records', 'sync'], 'readwrite')
  await transaction.objectStore('records').clear()
  await transaction.objectStore('sync').clear()
  await transaction.done
}
