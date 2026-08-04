export function isUpdateReady(workerState: ServiceWorkerState, hasController: boolean): boolean {
  return workerState === 'installed' && hasController
}

export function watchForServiceWorkerUpdate(
  registration: ServiceWorkerRegistration,
  onUpdateReady: (worker: ServiceWorker) => void,
): void {
  if (registration.waiting && navigator.serviceWorker.controller) onUpdateReady(registration.waiting)
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    if (!worker) return
    worker.addEventListener('statechange', () => {
      if (isUpdateReady(worker.state, navigator.serviceWorker.controller !== null)) onUpdateReady(worker)
    })
  })
}
