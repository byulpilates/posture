const CACHE_NAME = 'pilates-v2';
const SB_URL = 'https://phbdaxipaenyphwrebjz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoYmRheGlwYWVueXBod3JlYmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTA4MTAsImV4cCI6MjA5MDUyNjgxMH0.ScVK7ckOjTS-umOUstlo-CgQAWJ5NpYXoSBrluxqvNM';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(list => {
      for (const client of list) {
        if (client.url.includes('posture') || client.url.includes('first')) {
          return client.focus();
        }
      }
      return clients.openWindow('/posture/posture.html');
    })
  );
});

// 메인 앱에서 메시지 수신
self.addEventListener('message', e => {
  if (e.data === 'START_REALTIME') startRealtime();
  if (e.data === 'CHECK_PENDING') checkPending();
});

// Supabase Realtime WebSocket 연결
let ws = null;
let wsRetryTimer = null;

function startRealtime() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  connectWS();
}

function connectWS() {
  try {
    ws = new WebSocket(
      `wss://${SB_URL.replace('https://', '')}/realtime/v1/websocket?apikey=${SB_KEY}&vsn=1.0.0`
    );
    ws.onopen = () => {
      ws.send(JSON.stringify({
        topic: 'realtime:public:health_forms',
        event: 'phx_join',
        payload: {},
        ref: '1'
      }));
      // 하트비트 (30초마다)
      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:'hb'}));
        }
      }, 30000);
    };
    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === 'INSERT' && msg.payload?.record) {
          const rec = msg.payload.record;
          if (rec.status === 'pending') {
            await showNotification(rec.name);
          }
        }
      } catch(err) {}
    };
    ws.onclose = () => {
      // 연결 끊기면 5초 후 재연결
      wsRetryTimer = setTimeout(connectWS, 5000);
    };
    ws.onerror = () => { ws.close(); };
  } catch(e) {}
}

// 알림 표시
async function showNotification(name) {
  const cache = await caches.open(CACHE_NAME);
  self.registration.showNotification('📨 새 상담지 도착!', {
    body: `${name}님이 상담지를 제출했어요 🌿`,
    icon: 'https://raw.githubusercontent.com/byulpilates/posture/main/15.png',
    badge: 'https://raw.githubusercontent.com/byulpilates/posture/main/15.png',
    tag: 'new-consult',
    renotify: true,
    requireInteraction: false,
  });
}

// 폴링 방식 (백업 - 앱 열릴 때)
async function checkPending() {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/health_forms?status=eq.pending&order=created_at.desc&limit=1`,
      { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      const latest = data[0];
      const cache = await caches.open(CACHE_NAME);
      const lastRes = await cache.match('last-notified-id');
      const lastId = lastRes ? await lastRes.text() : '';
      if (latest.id !== lastId) {
        await cache.put('last-notified-id', new Response(latest.id));
        await showNotification(latest.name);
      }
    }
  } catch(e) {}
}

// SW 시작하자마자 Realtime 연결
connectWS();
