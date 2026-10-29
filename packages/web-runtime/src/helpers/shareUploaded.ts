// Counterpart of `packages/web-container/sw.js`: the service worker parks files
// shared to the installed web app in IndexedDB, the `share_uploaded` route picks
// them up here. Database and store names must match the service worker.
const SHARE_DB_NAME = 'share_uploaded'
const SHARE_DB_STORE = 'files'

type SharedFileEntry = {
  file: File
  name: string
  receivedAt: number
}

export function registerShareServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }
  const serviceWorkerUrl = new URL('sw.js', document.baseURI)
  navigator.serviceWorker
    .register(serviceWorkerUrl, { scope: new URL('./', document.baseURI).pathname })
    .catch((e) => console.error('service worker registration failed', e))
}

function openShareDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(SHARE_DB_STORE, { autoIncrement: true })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function readSharedFiles(): Promise<{ key: IDBValidKey; file: File }[]> {
  const db = await openShareDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SHARE_DB_STORE, 'readonly')
      const store = transaction.objectStore(SHARE_DB_STORE)
      const keysRequest = store.getAllKeys()
      const valuesRequest = store.getAll()
      transaction.oncomplete = () => {
        const entries = valuesRequest.result as SharedFileEntry[]
        resolve(
          entries.map((entry, index) => ({
            key: keysRequest.result[index],
            file: new File([entry.file], entry.name || entry.file.name, { type: entry.file.type })
          }))
        )
      }
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

export async function deleteSharedFile(key: IDBValidKey) {
  const db = await openShareDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(SHARE_DB_STORE, 'readwrite')
      transaction.objectStore(SHARE_DB_STORE).delete(key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}
