import { doc, setDoc } from 'firebase/firestore'
import { firebaseAuth, firebaseFirestore } from '../firebase/client'
import { isOwnerUid } from '../firebase/owner'
import { markRecordSynced } from '../storage/database'
import type { RecordData } from '../storage/types'
import { firestoreRecord, recordDocumentPath } from './format'

export async function uploadNewRecord(record: RecordData): Promise<boolean> {
  const auth = firebaseAuth()
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user || !isOwnerUid(user.uid)) {
    return false
  }

  const reference = doc(firebaseFirestore(), recordDocumentPath(record.id))
  await setDoc(reference, firestoreRecord(record))
  return markRecordSynced(record)
}
