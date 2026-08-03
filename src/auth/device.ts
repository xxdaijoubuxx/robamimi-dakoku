import { OWNER_UID } from '../firebase/owner'
import type { AppSettings, SetupStage } from '../storage/types'

const SETUP_STAGE_ORDER: Record<SetupStage, number> = {
  'not-started': 0,
  authenticated: 1,
  'offline-ready': 2,
  complete: 3,
}

export function isDailyUseConfigured(settings: AppSettings): boolean {
  return settings.ownerUid === OWNER_UID && SETUP_STAGE_ORDER[settings.setupStage] >= SETUP_STAGE_ORDER.authenticated
}

export function authenticateDevice(settings: AppSettings, uid: string): AppSettings {
  if (uid !== OWNER_UID) {
    throw new Error('本人UIDと一致しません。')
  }

  return {
    ...settings,
    ownerUid: uid,
    setupStage: SETUP_STAGE_ORDER[settings.setupStage] < SETUP_STAGE_ORDER.authenticated
      ? 'authenticated'
      : settings.setupStage,
  }
}
