import { hostRoomPath } from '../composables/roomPaths'

export const HOST_STEPS = [
  'Setup',
  'Upload',
  'OCR',
  'Split',
  'Verify',
  'Pay method',
  'Invite',
]

export const MEMBER_STEPS = ['Join', 'Assign', 'Pay', 'Done']

export function hostStepIndex(status) {
  const map = {
    draft: 0,
    uploaded: 1,
    scanning: 2,
    split_mode: 3,
    review: 4,
    payment_setup: 5,
    open: 6,
    overdue: 6,
    completed: 6,
  }
  return map[status] ?? 0
}

export function memberStepIndex({ splitMode, paid, confirmed }) {
  if (confirmed) return 3
  if (paid) return 3
  if (splitMode === 'equal') return 2
  return 1
}

/** Resume host setup at the correct step for room status. */
export function hostRouteForStatus(roomOrSlug, status) {
  const routes = {
    draft: hostRoomPath(roomOrSlug, 'upload'),
    uploaded: hostRoomPath(roomOrSlug, 'scan'),
    scanning: hostRoomPath(roomOrSlug, 'scan'),
    split_mode: hostRoomPath(roomOrSlug, 'split-mode'),
    review: hostRoomPath(roomOrSlug, 'review'),
    payment_setup: hostRoomPath(roomOrSlug, 'payment-setup'),
    open: hostRoomPath(roomOrSlug, 'dashboard'),
    overdue: hostRoomPath(roomOrSlug, 'dashboard'),
    completed: hostRoomPath(roomOrSlug, 'dashboard'),
  }
  return routes[status] ?? hostRoomPath(roomOrSlug, 'upload')
}

export function isHostDashboardStatus(status) {
  return status === 'open' || status === 'overdue' || status === 'completed'
}

export const HOST_ROUTE_ORDER = [
  'upload',
  'scan',
  'split-mode',
  'review',
  'payment-setup',
  'dashboard',
]

const STATUS_MAX_ROUTE_INDEX = {
  draft: 0,
  uploaded: 1,
  scanning: 2,
  split_mode: 3,
  review: 4,
  payment_setup: 5,
  open: 6,
  overdue: 6,
  completed: 6,
}

export function hostRouteIndex(routeName) {
  const i = HOST_ROUTE_ORDER.indexOf(routeName)
  return i >= 0 ? i : -1
}

export function hostMaxAllowedRouteIndex(status) {
  return STATUS_MAX_ROUTE_INDEX[status] ?? 0
}

export function hostBackRoute(roomOrSlug, routeName) {
  const map = {
    upload: '/',
    scan: hostRoomPath(roomOrSlug, 'upload'),
    'split-mode': hostRoomPath(roomOrSlug, 'upload'),
    review: hostRoomPath(roomOrSlug, 'split-mode'),
    'payment-setup': hostRoomPath(roomOrSlug, 'review'),
    dashboard: '/',
  }
  return map[routeName] ?? '/'
}

export function staticBackRoute(routeName) {
  const map = {
    create: '/',
    'enter-room': '/',
    join: '/enter-room',
    assign: '/',
    'member-done': '/',
    history: '/',
  }
  return map[routeName] ?? '/'
}

export function memberBackRoute(roomOrSlug, routeName, { splitMode, inviteToken } = {}) {
  if (routeName === 'pay') {
    if (splitMode === 'equal' && inviteToken) {
      return `/join/${inviteToken}`
    }
    const slug =
      inviteToken ||
      (typeof roomOrSlug === 'object' ? roomOrSlug?.roomCode : roomOrSlug) ||
      roomOrSlug
    return `/room/${String(slug).toUpperCase()}/assign`
  }
  return staticBackRoute(routeName)
}
