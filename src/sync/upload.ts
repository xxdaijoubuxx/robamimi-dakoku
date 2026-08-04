import { doc, setDoc } from 'firebase/firestore'
import { firebaseAuth, firebaseFirestore } from '../firebase/client'
import { isOwnerUid } from '../firebase/owner'
import { markRecordSynced, markRecordSyncIssue } from '../storage/database'
import type { RecordData } from '../storage/types'
import { firestoreRecord, recordDocumentPath } from './format'
import { failedSyncStatus, firebaseErrorCode } from './error'
import { writeDiagnosticLog } from '../diagnostics/log'

export type UploadOutcome = 'synced' | 'pending' | 'failed' | 'reauth-required'

export async function uploadNewRecord(record: RecordData): Promise<UploadOutcome> {
  const auth = firebaseAuth()
  try {
    await auth.authStateReady()
    const user = auth.currentUser
    if (!user || !isOwnerUid(user.uid)) {
      await markRecordSyncIssue(record.id, 'reauth-required', 'auth-required')
      await writeDiagnosticLog('sync-record', 'failure', { recordId: record.id, errorCode: 'auth-required' })
      return 'reauth-required'
    }

    const reference = doc(firebaseFirestore(), recordDocumentPath(record.id))
    await setDoc(reference, firestoreRecord(record))
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
