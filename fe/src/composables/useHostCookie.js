const COOKIE_NAME = 'sixseven_host'
const MAX_AGE_SEC = 365 * 24 * 60 * 60

function readCookie() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function writeCookie(value) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`
}

/** Room IDs this browser has created as host (no login). */
export function getHostRoomIds() {
  const raw = readCookie()
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export function hasHostCookie() {
  return getHostRoomIds().length > 0
}

/** Mark this device as a host and remember the room. */
export function registerHostRoom(roomId) {
  if (!roomId) return
  const ids = getHostRoomIds()
  if (!ids.includes(roomId)) ids.unshift(roomId)
  writeCookie(ids.slice(0, 30).join(','))
}

/** True if this browser/user is the bill host (not a paying member). */
export function isHostOfRoom(room, userId = null) {
  if (!room) return false
  if (getHostRoomIds().includes(room.id)) return true
  if (!userId) return false
  if (userId === room.hostUserId) return true
  const participant = room.members?.find((m) => m.id === userId)
  return Boolean(participant?.isHost)
}
