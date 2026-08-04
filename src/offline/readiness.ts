export interface OfflineReadiness {
  ready: boolean
  missing: string[]
}

export async function checkOfflineReadiness(timeoutMilliseconds = 5000): Promise<OfflineReadiness> {
  if (!('serviceWorker' in navigator)) return { ready: false, missing: ['service-worker'] }
  const registration = await navigator.serviceWorker.ready
  const worker = registration.active
  if (!worker) return { ready: false, missing: ['active-service-worker'] }

  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(() => resolve({ ready: false, missing: ['timeout'] }), timeoutMilliseconds)
    channel.port1.onmessage = (event: MessageEvent<OfflineReadiness>) => {
      window.clearTimeout(timeout)
      resolve(event.data)
    }
    worker.postMessage({ type: 'CHECK_OFFLINE_READY' }, [channel.port2])
  })
}
