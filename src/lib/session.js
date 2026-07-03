// Privacy-friendly, self-hosted visit tracking. A random sessionId in localStorage
// lets the backend separate unique visitors from raw page views.
const SID_KEY = 'sj-sid'

function sessionId() {
  let sid = localStorage.getItem(SID_KEY)
  if (!sid) {
    sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(SID_KEY, sid)
  }
  return sid
}

function device() {
  const w = window.innerWidth
  if (w < 640) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

let lastPath = null

export function trackPageView(path) {
  if (path === lastPath) return // avoid duplicate fires (StrictMode double-effect)
  lastPath = path
  const body = JSON.stringify({
    path,
    sessionId: sessionId(),
    referrer: document.referrer || '',
    device: device(),
  })
  // Prefer sendBeacon so it survives navigation; fall back to fetch.
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/track', new Blob([body], { type: 'application/json' }))
      return
    }
  } catch { /* ignore */ }
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}
