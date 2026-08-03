import { doc, setDoc } from 'firebase/firestore'
import { firebaseAuth, firebaseFirestore } from '../firebase/client'
import { isOwnerUid } from '../firebase/owner'
import { markRecordSynced, markRecordSyncIssue } from '../storage/database'
import type { RecordData } from '../storage/types'
import { firestoreRecord, recordDocumentPath } from './format'
import { failedSyncStatus, firebaseErrorCode } from './error'

export type UploadOutcome = 'synced' | 'pending' | 'failed' | 'reauth-required'

export async function uploadNewRecord(record: RecordData): Promise<UploadOutcome> {
  const auth = firebaseAuth()
  try {
    await auth.authStateReady()
    const user = auth.currentUser
    if (!user || !isOwnerUid(user.uid)) {
      await markRecordSyncIssue(record.id, 'reauth-required', 'auth-required')
      return 'reauth-required'
    }

    const reference = doc(firebaseFirestore(), recordDocumentPath(record.id))
    await setDoc(reference, firestoreRecord(record))
    return await markRecordSynced(record) ? 'synced' : 'pending'
  } catch (error) {
    const status = failedSyncStatus(error)
    await markRecordSyncIssue(record.id, status, firebaseErrorCode(error))
    return status
  }
}
