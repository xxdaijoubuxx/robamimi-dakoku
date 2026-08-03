import { readFile } from 'node:fs/promises'
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { OWNER_UID } from './owner'

const PROJECT_ID = 'demo-robamimi-dakoku'
const RECORD_ID = 'record-1'

let testEnvironment: RulesTestEnvironment

function validRecord(overrides: Record<string, unknown> = {}) {
  const now = Timestamp.fromMillis(1_786_000_000_000)

  return {
    kind: 'wake',
    occurredAt: now,
    timezone: 'Asia/Tokyo',
    body: '',
    createdAt: now,
    updatedAt: now,
    revision: 1,
    deletedAt: null,
    deviceId: 'test-device',
    ...overrides,
  }
}

function recordRef(uid: string, recordId = RECORD_ID) {
  return doc(
    testEnvironment.authenticatedContext(uid).firestore(),
    'users',
    uid,
    'records',
    recordId,
  )
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: await readFile('firestore.rules', 'utf8'),
    },
  })
})

afterEach(async () => {
  await testEnvironment.clearFirestore()
})

afterAll(async () => {
  await testEnvironment.cleanup()
})

describe('Firestore Security Rules', () => {
  it('本人UIDの正しい記録の作成と読取を許可する', async () => {
    const reference = recordRef(OWNER_UID)

    await assertSucceeds(setDoc(reference, validRecord()))
    await assertSucceeds(getDoc(reference))
  })

  it('未ログインの読取と作成を拒否する', async () => {
    const database = testEnvironment.unauthenticatedContext().firestore()
    const reference = doc(database, 'users', OWNER_UID, 'records', RECORD_ID)

    await assertFails(getDoc(reference))
    await assertFails(setDoc(reference, validRecord()))
  })

  it('別UIDによる本人領域への読書きを拒否する', async () => {
    const database = testEnvironment.authenticatedContext('different-user').firestore()
    const reference = doc(database, 'users', OWNER_UID, 'records', RECORD_ID)

    await assertFails(getDoc(reference))
    await assertFails(setDoc(reference, validRecord()))
  })

  it('別UID自身の領域への作成も拒否する', async () => {
    await assertFails(setDoc(recordRef('different-user'), validRecord()))
  })

  it.each([
    ['不正な種類', { kind: 'exercise' }],
    ['不正な日時型', { occurredAt: '2026-08-03T12:00:00Z' }],
    ['0以下の変更版', { revision: 0 }],
    ['不正な削除日時型', { deletedAt: '2026-08-03T12:00:00Z' }],
    ['余計な項目', { unexpected: true }],
  ])('%sを拒否する', async (_label, overrides) => {
    await assertFails(setDoc(recordRef(OWNER_UID), validRecord(overrides)))
  })

  it('必須項目の不足を拒否する', async () => {
    const { deviceId: _deviceId, ...record } = validRecord()

    await assertFails(setDoc(recordRef(OWNER_UID), record))
  })

  it('記録の物理削除を拒否する', async () => {
    const reference = recordRef(OWNER_UID)
    await assertSucceeds(setDoc(reference, validRecord()))

    await assertFails(deleteDoc(reference))
  })

  it('records以外の場所を拒否する', async () => {
    const database = testEnvironment.authenticatedContext(OWNER_UID).firestore()
    const reference = doc(database, 'users', OWNER_UID, 'settings', 'main')

    await assertFails(setDoc(reference, { enabled: true }))
  })
})
