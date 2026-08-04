import type { DiagnosticLog, DiagnosticOperation, DiagnosticOutcome } from '../storage/types'

export interface DiagnosticDetails {
  errorCode?: string | null
  recordId?: string | null
  occurredAt?: string
}

export function createDiagnosticLog(
  operation: DiagnosticOperation,
  outcome: DiagnosticOutcome,
  details: DiagnosticDetails = {},
): DiagnosticLog {
  return {
    occurredAt: details.occurredAt ?? new Date().toISOString(),
    appVersion: __APP_VERSION__,
    operation,
    outcome,
    errorCode: details.errorCode ?? null,
    recordId: details.recordId ?? null,
  }
}

export function safeErrorCode(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String(error.code)
    if (/^[a-z0-9_./-]{1,80}$/i.test(code)) return code
  }
  return fallback
}
