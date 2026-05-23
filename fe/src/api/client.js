const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function assertApiConfigured() {
  if (!API_URL) {
    throw new ApiError('Set VITE_API_URL in fe/.env (e.g. http://localhost:3000)', 0)
  }
}

export async function apiFetch(path, options = {}) {
  assertApiConfigured()

  const headers = { ...(options.headers || {}) }
  let body = options.body

  if (body != null && !(body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
    body = JSON.stringify(body)
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    credentials: 'include',
    headers,
    body,
  })

  let data = {}
  try {
    data = await res.json()
  } catch {
    data = {}
  }
  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : data.error?.message || res.statusText
    throw new ApiError(msg || `API error: ${res.status}`, res.status)
  }
  return data
}

export function apiErrorMessage(err) {
  if (err instanceof ApiError) return err.message
  if (err?.message === 'Failed to fetch') {
    return 'Cannot reach the API. Is the backend running on port 3000? Check be/.env SUPABASE_URL.'
  }
  return err?.message || 'Request failed'
}

export const api = {
  createRoom: (body) => apiFetch('/rooms/create', { method: 'POST', body }),

  getRoom: (roomId) => apiFetch(`/rooms/${roomId}`),

  getRoomByCode: (roomCode) =>
    apiFetch(`/rooms/code/${encodeURIComponent(roomCode.trim())}`),

  joinRoom: (body) => apiFetch('/rooms/join', { method: 'POST', body }),

  uploadReceipt: (roomId, file) => {
    const form = new FormData()
    form.append('room_id', roomId)
    form.append('file', file)
    return apiFetch('/receipts/upload', { method: 'POST', body: form })
  },

  verifyReceipt: (body) => apiFetch('/receipts/verify', { method: 'PUT', body }),

  configSplit: ({ roomId, splitMode, paymentMethodType, paymentMethodDetail, qrFile }) => {
    const form = new FormData()
    form.append('room_id', roomId)
    form.append('split_mode', splitMode)
    form.append('payment_method_type', paymentMethodType)
    form.append('payment_method_detail', paymentMethodDetail || '')
    if (qrFile) form.append('qr_code_file', qrFile)
    return apiFetch('/bills/config-split', { method: 'POST', body: form })
  },

  assignItems: (body) => apiFetch('/bills/assign-items', { method: 'POST', body }),

  verifyMemberPayment: (body) => apiFetch('/payments/verify-member', { method: 'POST', body }),

  submitProof: ({ roomId, userId, file }) => {
    const form = new FormData()
    form.append('room_id', roomId)
    form.append('user_id', userId)
    form.append('proof_file', file)
    return apiFetch('/payments/submit-proof', { method: 'POST', body: form })
  },
}
