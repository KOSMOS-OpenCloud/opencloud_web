// Service worker for the installed web app (PWA).
//
// Only purpose for now: receive files via the Web Share Target API (see
// `share_target` in manifest.json). The POST to `share_uploaded` is intercepted,
// the files are parked in IndexedDB and the browser is redirected to the
// `share_uploaded` route, which uploads them once the user is authenticated.
// All other requests pass through untouched.

const SHARE_DB_NAME = 'share_uploaded'
const SHARE_DB_STORE = 'files'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

function openShareDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(SHARE_DB_STORE, { autoIncrement: true })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function storeSharedFiles(sharedFiles) {
  const db = await openShareDb()
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(SHARE_DB_STORE, 'readwrite')
    const store = transaction.objectStore(SHARE_DB_STORE)
    for (const sharedFile of sharedFiles) {
      store.add({ file: sharedFile, name: sharedFile.name, receivedAt: Date.now() })
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

async function handleShareTarget(request, shareTargetUrl) {
  try {
    const formData = await request.formData()
    const sharedFiles = formData.getAll('files').filter((entry) => entry instanceof File)
    await storeSharedFiles(sharedFiles)
  } catch (e) {
    console.error('share_uploaded: storing shared files failed', e)
  }
  return Response.redirect(shareTargetUrl, 303)
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'POST') {
    return
  }
  const shareTargetUrl = new URL('share_uploaded', self.registration.scope).href
  const requestUrl = new URL(request.url)
  if (requestUrl.origin + requestUrl.pathname !== shareTargetUrl) {
    return
  }
  event.respondWith(handleShareTarget(request, shareTargetUrl))
})
