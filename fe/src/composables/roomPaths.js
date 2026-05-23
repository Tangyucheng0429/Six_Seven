import { getRoomById } from './useRoomState'
import { isRoomCode } from './roomCodes'

export { isRoomCode, isUuid } from './roomCodes'

/** Public slug for member URLs — always 6-char code when available. */
export function roomSlug(roomOrParam) {
  if (typeof roomOrParam === 'string') {
    const s = roomOrParam.trim()
    if (isRoomCode(s)) return s.toUpperCase()
    const room = getRoomById(s)
    if (room?.roomCode) return String(room.roomCode).toUpperCase()
    if (room?.inviteToken && isRoomCode(room.inviteToken)) {
      return String(room.inviteToken).toUpperCase()
    }
    return s
  }
  const code = roomOrParam?.roomCode || roomOrParam?.inviteToken
  if (code && isRoomCode(code)) return String(code).toUpperCase()
  return roomOrParam?.id || ''
}

const MEMBER_STEP_PATH = {
  assign: 'assign',
  pay: 'pay',
  done: 'done',
}

/** Member flow URLs: `/room/JKRRK6/pay` (not UUID). */
export function memberRoomPath(roomOrSlug, step) {
  const slug = roomSlug(roomOrSlug)
  const segment = MEMBER_STEP_PATH[step]
  if (!slug || !segment) return '/enter-room'
  return `/room/${slug}/${segment}`
}

export function memberPathForRouteName(room, routeName) {
  if (routeName === 'assign') return memberRoomPath(room, 'assign')
  if (routeName === 'pay') return memberRoomPath(room, 'pay')
  if (routeName === 'member-done') return memberRoomPath(room, 'done')
  return null
}

const HOST_STEP_PATH = {
  upload: 'upload',
  scan: 'scan',
  'split-mode': 'split-mode',
  review: 'review',
  'payment-setup': 'payment-setup',
  dashboard: '',
}

/** Host flow URLs: `/room/JKRRK6` or `/room/JKRRK6/upload` (not UUID). */
export function hostRoomPath(roomOrSlug, step) {
  const slug = roomSlug(roomOrSlug)
  if (!slug) return '/'
  const segment = step === 'dashboard' ? '' : HOST_STEP_PATH[step]
  if (!segment) return `/room/${slug}`
  return `/room/${slug}/${segment}`
}

export function hostPathForRouteName(room, routeName) {
  if (routeName === 'dashboard') return hostRoomPath(room, 'dashboard')
  const segment = HOST_STEP_PATH[routeName]
  return segment != null ? hostRoomPath(room, routeName) : null
}
