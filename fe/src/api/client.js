const API_URL = import.meta.env.VITE_API_URL || ''

export async function apiFetch(path, options = {}) {
  if (!API_URL) {
    return { ok: true, mock: true, data: null }
  }
  const res = await fetch(`${API_URL}${path}`, options)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const api = {
  createRoom: (body) => apiFetch('/rooms', { method: 'POST', body: JSON.stringify(body) }),
  uploadReceipt: (roomId, file) => apiFetch(`/rooms/${roomId}/receipt`, { method: 'POST', body: file }),
  parseReceipt: (roomId) => apiFetch(`/rooms/${roomId}/parse`, { method: 'POST' }),
}
