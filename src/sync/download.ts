import { collection, getDocs } from 'firebase/firestore'
import { firebaseAuth, firebaseFirestore } from '../firebase/client'
import { OWNER_UID, isOwnerUid } from '../firebase/owner'
import { importRemoteRecords } from '../storage/database'
import { recordFromFirestore } from './format'

export async function downloadRemoteRecords(): Promise<number> {
  const auth = firebaseAuth()
  await auth.authStateReady()
  if (!auth.currentUser || !isOwnerUid(auth.currentUser.uid)) return 0

  const snapshot = await getDocs(collection(firebaseFirestore(), 'users', OWNER_UID, 'records'))
  const records = snapshot.docs.map((document) => recordFromFirestore(document.id, document.data()))
  return importRemoteRecords(records)
}
