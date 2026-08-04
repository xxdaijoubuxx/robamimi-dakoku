import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const outputDirectory = fileURLToPath(new URL('../dist/', import.meta.url))
const basePath = '/robamimi-dakoku/'

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)))
    } else if (entry.name !== 'sw.js') {
      files.push(path)
    }
  }
  return files
}

const files = await listFiles(outputDirectory)
const relativeFiles = files
  .map((file) => relative(outputDirectory, file).split(sep).join('/'))
  .sort()
const versionHash = createHash('sha256')

for (const file of files.sort()) {
  versionHash.update(await readFile(file))
}

const cacheName = `robamimi-dakoku-${versionHash.digest('hex').slice(0, 12)}`
const precacheUrls = relativeFiles.map((file) => `${basePath}${file}`)

const source = `const CACHE_NAME = ${JSON.stringify(cacheName)}
const BASE_PATH = ${JSON.stringify(basePath)}
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith('robamimi-dakoku-') && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin || !requestUrl.pathname.startsWith(BASE_PATH)) return

  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached

      if (event.request.mode === 'navigate' && requestUrl.pathname.endsWith('/')) {
        const indexUrl = new URL(requestUrl.pathname + 'index.html', self.location.origin)
        const cachedIndex = await caches.match(indexUrl)
        if (cachedIndex) return cachedIndex
      }

      try {
        const response = await fetch(event.request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(event.request, response.clone())
        }
        return response
      } catch (error) {
        const fallback = await caches.match(BASE_PATH + 'index.html')
        if (fallback && event.request.mode === 'navigate') return fallback
        throw error
      }
    }),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CHECK_OFFLINE_READY' || !event.ports[0]) return
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        const missing = []
        for (const url of PRECACHE_URLS) {
          if (!(await cache.match(url))) missing.push(url)
        }
        event.ports[0].postMessage({ ready: missing.length === 0, missing })
      })
      .catch(() => event.ports[0].postMessage({ ready: false, missing: PRECACHE_URLS })),
  )
})
`

await writeFile(join(outputDirectory, 'sw.js'), source)
console.log(`Generated ${cacheName} with ${precacheUrls.length} files`)
