const CACHE_NAME = 'pilates-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// 푸시 알림 수신
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || '📨 새 상담지 도착!';
  const body = data.body || '새 상담지가 제출됐어요 🌿';
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: 'https://raw.githubusercontent.com/byulpilates/posture/main/15.png',
      badge: 'https://raw.githubusercontent.com/byulpilates/posture/main/15.png',
      tag: 'new-consult',
      renotify: true,
    })
  );
});

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(list => {
      for (const client of list) {
        if (client.url.includes('posture') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/posture/posture.html');
    })
  );
});

// Supabase Realtime 폴링 (백그라운드)
self.addEventListener('message', e => {
  if (e.data === 'CHECK_PENDING') checkPending();
});

async function checkPending() {
  try {
    const res = await fetch(
      'https://phbdaxipaenyphwrebjz.supabase.co/rest/v1/health_forms?status=eq.pending&order=created_at.desc&limit=1',
      {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoYmRheGlwYWVueXBod3JlYmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTA4MTAsImV4cCI6MjA5MDUyNjgxMH0.ScVK7ckOjTS-umOUstlo-CgQAWJ5NpYXoSBrluxqvNM',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoYmRheGlwYWVueXBod3JlYmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTA4MTAsImV4cCI6MjA5MDUyNjgxMH0.ScVK7ckOjTS-umOUstlo-CgQAWJ5NpYXoSBrluxqvNM'
        }
      }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      const latest = data[0];
      // 마지막으로 알림 보낸 id 확인
      const cache = await caches.open(CACHE_NAME);
      const lastRes = await cache.match('last-notified-id');
      const lastId = lastRes ? await lastRes.text() : '';
      if (latest.id !== lastId) {
        await cache.put('last-notified-id', new Response(latest.id));
        self.registration.showNotification('📨 새 상담지 도착!', {
          body: `${latest.name}님이 상담지를 제출했어요 🌿`,
          icon: 'https://raw.githubusercontent.com/byulpilates/posture/main/15.png',
          tag: 'new-consult',
          renotify: true,
        });
      }
    }
  } catch(e) {}
}

// 백그라운드 주기적 체크 (1분마다)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-pending') {
    e.waitUntil(checkPending());
  }
});
