/** Same charset as backend generateRoomCode (no 0/O/1/I/L). */
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/i
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isRoomCode(value) {
  return ROOM_CODE_RE.test(String(value || '').trim())
}

export function isUuid(value) {
  return UUID_RE.test(String(value || '').trim())
}
