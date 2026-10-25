const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  static: `${CACHE_VERSION}-static`,
  dynamic: `${CACHE_VERSION}-dynamic`,
  api: `${CACHE_VERSION}-api`,
};

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAMES.static).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!Object.values(CACHE_NAMES).includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(networkFirst(request));
  }

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAMES.dynamic);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAMES.api);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-payments') {
    event.waitUntil(syncOfflinePayments());
  }
});

async function syncOfflinePayments() {
  const db = await openIndexedDB();
  const pendingPayments = await getAllPending(db);

  for (const payment of pendingPayments) {
    try {
      await fetch('/api/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment),
      });
      await deletePending(db, payment.id);
    } catch {
      console.error('Sync failed for payment:', payment.id);
    }
  }
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('StellarSplitDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingPayments')) {
        db.createObjectStore('pendingPayments', { keyPath: 'id' });
      }
    };
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingPayments'], 'readonly');
    const store = transaction.objectStore('pendingPayments');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deletePending(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingPayments'], 'readwrite');
    const store = transaction.objectStore('pendingPayments');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
