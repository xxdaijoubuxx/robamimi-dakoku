import type { SyncStatus } from '../storage/types'

const REAUTH_CODES = new Set([
  'auth/invalid-user-token',
  'auth/user-token-expired',
  'permission-denied',
  'unauthenticated',
])

export function firebaseErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code.replace(/^firestore\//, '')
  }
  return 'unknown'
}

export function failedSyncStatus(error: unknown): Extract<SyncStatus, 'failed' | 'reauth-required'> {
  return REAUTH_CODES.has(firebaseErrorCode(error)) ? 'reauth-required' : 'failed'
}
