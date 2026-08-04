import type { AppStatusSummary } from '../status/summary'
import type { DiagnosticLog } from '../storage/types'

interface DiagnosticRuntimeStatus {
  online: boolean
  googleLogin: 'active' | 'signed-out' | 'different-account'
}

interface DiagnosticExport {
  generatedAt: string
  appVersion: string
  dataVersion: number
  runtime: DiagnosticRuntimeStatus
  status: Omit<AppStatusSummary, 'dataVersion'>
  logs: Array<Omit<DiagnosticLog, 'id'>>
}

export function diagnosticFilename(now = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `robamimi-diagnostics-${year}-${month}-${day}.json`
}

export function createDiagnosticExport(
  summary: AppStatusSummary,
  logs: DiagnosticLog[],
  runtime: DiagnosticRuntimeStatus,
  now = new Date(),
): DiagnosticExport {
  const { dataVersion, ...status } = summary
  return {
    generatedAt: now.toISOString(),
    appVersion: __APP_VERSION__,
    dataVersion,
    runtime,
    status,
    logs: logs.map(({ id: _id, ...log }) => log),
  }
}

export function downloadDiagnosticExport(
  summary: AppStatusSummary,
  logs: DiagnosticLog[],
  runtime: DiagnosticRuntimeStatus,
  now = new Date(),
): string {
  const filename = diagnosticFilename(now)
  const content = `${JSON.stringify(createDiagnosticExport(summary, logs, runtime, now), null, 2)}\n`
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  return filename
}
