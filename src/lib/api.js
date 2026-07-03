// Tiny fetch wrapper for the Shubra API. Dev uses Vite proxy (/api -> :4200).
const TOKEN_KEY = 'sj-admin-token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(method, path, body, { auth = false, isForm = false } = {}) {
  const headers = {}
  if (!isForm) headers['Content-Type'] = 'application/json'
  if (auth) headers.Authorization = `Bearer ${getToken()}`

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })

  let json = null
  try { json = await res.json() } catch { /* no body */ }

  if (!res.ok) {
    const msg = json?.message || `Request failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.details = json?.details
    throw err
  }
  return json?.data ?? json
}

// Normalize a product so legacy components keyed on `id` keep working.
export function normalizeProduct(p) {
  if (!p || typeof p !== 'object') return p
  return { ...p, id: p._id || p.id, originalPrice: p.mrp || p.originalPrice || 0 }
}

export const api = {
  get:   (path, opts)       => request('GET', path, null, opts),
  post:  (path, body, opts) => request('POST', path, body, opts),
  patch: (path, body, opts) => request('PATCH', path, body, opts),
  del:   (path, opts)       => request('DELETE', path, null, opts),

  // Upload one file (admin). `file` is a File object.
  async upload(file) {
    const fd = new FormData()
    fd.append('file', file)
    return request('POST', '/upload', fd, { auth: true, isForm: true })
  },
  async uploadMany(files) {
    const fd = new FormData()
    Array.from(files).forEach((f) => fd.append('files', f))
    return request('POST', '/upload/multiple', fd, { auth: true, isForm: true })
  },
}
