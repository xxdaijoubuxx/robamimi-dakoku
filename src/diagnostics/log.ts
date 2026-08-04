import { addDiagnosticLog } from '../storage/database'
import type { DiagnosticOperation, DiagnosticOutcome } from '../storage/types'
import { createDiagnosticLog, type DiagnosticDetails } from './model'

export { safeErrorCode } from './model'

export async function writeDiagnosticLog(
  operation: DiagnosticOperation,
  outcome: DiagnosticOutcome,
  details: DiagnosticDetails = {},
): Promise<void> {
  try {
    await addDiagnosticLog(createDiagnosticLog(operation, outcome, details))
  } catch (error) {
    console.error('端末内診断ログを保存できませんでした。', error)
  }
}
