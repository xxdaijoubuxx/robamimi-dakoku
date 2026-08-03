import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { firebaseConfig } from './config'

export function firebaseApp() {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
}

export function firebaseAuth() {
  return getAuth(firebaseApp())
}

export function firebaseFirestore() {
  return getFirestore(firebaseApp())
}
