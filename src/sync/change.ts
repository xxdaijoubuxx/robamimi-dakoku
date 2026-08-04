import { doc, runTransaction } from 'firebase/firestore'
import { firebaseAuth, firebaseFirestore } from '../firebase/client'
import { isOwnerUid } from '../firebase/owner'
import { markRecordConflict, markRecordSynced, markRecordSyncIssue } from '../storage/database'
import type { RecordData, SyncEntry } from '../storage/types'
import { failedSyncStatus, firebaseErrorCode } from './error'
import { firestoreRecord, recordDocumentPath, recordFromFirestore } from './format'
import type { UploadOutcome } from './upload'
import { writeDiagnosticLog } from '../diagnostics/log'

export async function uploadChangedRecord(record: RecordData, sync: SyncEntry): Promise<UploadOutcome | 'conflict'> {
  const auth = firebaseAuth()
  await auth.authStateReady()
  if (!auth.currentUser || !isOwnerUid(auth.currentUser.uid)) {
    await markRecordSyncIssue(record.id, 'reauth-required', 'auth-required')
    await writeDiagnosticLog('sync-record', 'failure', { recordId: record.id, errorCode: 'auth-required' })
    return 'reauth-required'
  }
  try {
    let conflict: RecordData | null = null
    await runTransaction(firebaseFirestore(), async (transaction) => {
      const reference = doc(firebaseFirestore(), recordDocumentPath(record.id))
      const snapshot = await transaction.get(reference)
      if (!snapshot.exists()) throw Object.assign(new Error('remote missing'), { code: 'not-found' })
      const remote = recordFromFirestore(snapshot.id, snapshot.data())
      if (remote.revision !== sync.syncedRevision) { conflict = remote; return }
      transaction.set(reference, firestoreRecord(record))
    })
    if (conflict) {
      await markRecordConflict(record.id, conflict)
      await writeDiagnosticLog('conflict-detected', 'failure', { recordId: record.id, errorCode: 'remote-changed' })
      return 'conflict'
    }
    const outcome = await markRecordSynced(record) ? 'synced' : 'pending'
    await writeDiagnosticLog('sync-record', 'success', { recordId: record.id })
    return outcome
  } catch (error) {
    const status = failedSyncStatus(error)
    const errorCode = firebaseErrorCode(error)
    await markRecordSyncIssue(record.id, status, errorCode)
    await writeDiagnosticLog('sync-record', 'failure', { recordId: record.id, errorCode })
    return status
  }
}
