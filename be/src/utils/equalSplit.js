/**
 * Equal-split capacity: headcount includes host when host participates.
 */
export function normalizeEqualHeadcount(value, fallback = 2) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.min(99, n))
}

export function maxEqualSplitMembers(room, hostParticipates = room?.equal_host_participates) {
  const headcount = normalizeEqualHeadcount(room?.equal_headcount)
  const hostIn = hostParticipates !== false
  return hostIn ? Math.max(0, headcount - 1) : headcount
}

/** @param {{ user_id: string }[]} participants */
export function countEqualSplitMembers(room, participants) {
  const hostId = room?.host_id
  return (participants || []).filter((p) => p.user_id !== hostId).length
}

export function isEqualSplitRoomFull(room, participants, joiningUserId = null) {
  if (room?.split_mode !== 'EQUAL') return false
  const hostId = room.host_id
  if (joiningUserId && joiningUserId === hostId) return false
  if (joiningUserId && (participants || []).some((p) => p.user_id === joiningUserId)) {
    return false
  }
  const maxMembers = maxEqualSplitMembers(room)
  return countEqualSplitMembers(room, participants) >= maxMembers
}
