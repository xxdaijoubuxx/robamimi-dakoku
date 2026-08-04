import type { AppSettings, RecordData } from './types'
import type { PrototypeRecord } from '../prototype/types'

export const DATA_VERSION = 2

export function createInitialSettings(deviceId: string): AppSettings {
  return {
    key: 'main',
    ownerUid: null,
    deviceId,
    lastSyncAt: null,
    setupStage: 'not-started',
    shortcutsAdded: [],
    setupTestRecordId: null,
    dataVersion: DATA_VERSION,
  }
}

export function migratePrototypeRecord(
  record: PrototypeRecord,
  deviceId: string,
  timezone: string,
): RecordData {
  return {
    id: record.id,
    kind: record.kind,
    occurredAt: record.occurredAt,
    timezone,
    body: '',
    createdAt: record.createdAt,
    updatedAt: record.createdAt,
    revision: 1,
    deletedAt: null,
    deviceId,
  }
}
