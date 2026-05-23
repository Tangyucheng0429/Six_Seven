const ROOMS_KEY = 'sixseven_rooms'
const ACCESS_KEY = 'sixseven_my_access'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

/** Restore saved rooms into app state (same browser, no login). */
export function hydrateRoomsFromStorage(state) {
  const saved = readJson(ROOMS_KEY, {})
  for (const [id, room] of Object.entries(saved)) {
    if (!state.rooms[id]) state.rooms[id] = room
  }
}

/** Persist room + register this device as host or member. */
export function saveMyBill(room, { role, memberId = null }) {
  if (!room?.id) return

  const rooms = readJson(ROOMS_KEY, {})
  const { receiptImageUrl, ...lean } = room
  rooms[room.id] = {
    ...lean,
    receiptImageUrl: receiptImageUrl?.startsWith('blob:') ? null : receiptImageUrl,
  }
  writeJson(ROOMS_KEY, rooms)

  const access = readJson(ACCESS_KEY, [])
  const member = memberId ? room.members?.find((m) => m.id === memberId) : null
  const entry = {
    roomId: room.id,
    role,
    memberId,
    hostToken: room.hostToken,
    billName: room.name,
    hostName: room.hostName,
    status: room.status,
    updatedAt: new Date().toISOString(),
    myAmountDue: member?.amountDue ?? null,
    myPaid: member?.paid ?? null,
    myConfirmed: member?.confirmed ?? null,
  }

  const idx = access.findIndex(
    (a) => a.roomId === entry.roomId && a.role === entry.role && a.memberId === entry.memberId,
  )
  if (idx >= 0) access[idx] = entry
  else access.unshift(entry)

  writeJson(ACCESS_KEY, access.slice(0, 50))
}

export function getMyAccessList() {
  return readJson(ACCESS_KEY, []).sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  )
}

export function getMyRoomsFromStorage(state) {
  const access = getMyAccessList()
  return access
    .map((a) => {
      const room = state.rooms[a.roomId] || readJson(ROOMS_KEY, {})[a.roomId]
      return room ? { ...a, room } : null
    })
    .filter(Boolean)
}

export function openPathForEntry(entry) {
  if (entry.role === 'host') {
    return `/room/${entry.roomId}?token=${entry.hostToken}`
  }
  const room = entry.room
  if (!room) return `/join/${entry.roomId}`
  if (entry.myConfirmed) return `/room/${entry.roomId}/done`
  if (entry.myPaid) return `/room/${entry.roomId}/done`
  if (room.splitMode === 'equal') return `/room/${entry.roomId}/pay`
  if (entry.myAmountDue > 0 || room.status === 'open') {
    return `/room/${entry.roomId}/pay`
  }
  return `/room/${entry.roomId}/assign`
}
