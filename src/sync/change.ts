import { doc, runTransaction } from 'firebase/firestore'
import { firebaseAuth, firebaseFirestore } from '../firebase/client'
import { isOwnerUid } from '../firebase/owner'
import { markRecordConflict, markRecordSynced, markRecordSyncIssue } from '../storage/database'
import type { RecordData, SyncEntry } from '../storage/types'
import { failedSyncStatus, firebaseErrorCode } from './error'
import { firestoreRecord, recordDocumentPath, recordFromFirestore } from './format'
import type { UploadOutcome } from './upload'

export async function uploadChangedRecord(record: RecordData, sync: SyncEntry): Promise<UploadOutcome | 'conflict'> {
  const auth = firebaseAuth()
  await auth.authStateReady()
  if (!auth.currentUser || !isOwnerUid(auth.currentUser.uid)) {
    await markRecordSyncIssue(record.id, 'reauth-required', 'auth-required')
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
      return 'conflict'
    }
    return await markRecordSynced(record) ? 'synced' : 'pending'
  } catch (error) {
    const status = failedSyncStatus(error)
    await markRecordSyncIssue(record.id, status, firebaseErrorCode(error))
    return status
  }
}
