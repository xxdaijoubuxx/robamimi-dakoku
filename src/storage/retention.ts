export const RESTORE_WINDOW_DAYS = 30
export const RESTORE_WINDOW_MILLISECONDS = RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000

export function isWithinRestoreWindow(deletedAt: string | null, nowMilliseconds = Date.now()): boolean {
  if (deletedAt === null) {
    return false
  }
  const deletedMilliseconds = new Date(deletedAt).getTime()
  if (Number.isNaN(deletedMilliseconds)) {
    return false
  }
  return nowMilliseconds - deletedMilliseconds <= RESTORE_WINDOW_MILLISECONDS
}
