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
export function hostRouteForStatus(roomId, status) {
  const id = roomId
  const routes = {
    draft: `/room/${id}/upload`,
    uploaded: `/room/${id}/scan`,
    scanning: `/room/${id}/scan`,
    split_mode: `/room/${id}/split-mode`,
    review: `/room/${id}/review`,
    payment_setup: `/room/${id}/payment-setup`,
    open: `/room/${id}`,
    overdue: `/room/${id}`,
    completed: '/history',
  }
  return routes[status] ?? `/room/${id}/upload`
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
  open: 5,
  overdue: 5,
  completed: 5,
}

export function hostRouteIndex(routeName) {
  const i = HOST_ROUTE_ORDER.indexOf(routeName)
  return i >= 0 ? i : -1
}

export function hostMaxAllowedRouteIndex(status) {
  return STATUS_MAX_ROUTE_INDEX[status] ?? 0
}

export function hostBackRoute(roomId, routeName) {
  const id = roomId
  const map = {
    upload: '/',
    scan: `/room/${id}/upload`,
    'split-mode': `/room/${id}/upload`,
    review: `/room/${id}/split-mode`,
    'payment-setup': `/room/${id}/review`,
    dashboard: `/room/${id}/payment-setup`,
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

export function memberBackRoute(roomId, routeName, { splitMode, inviteToken } = {}) {
  const id = roomId
  if (routeName === 'pay') {
    if (splitMode === 'equal' && inviteToken) {
      return `/join/${inviteToken}?room=${id}`
    }
    return `/room/${id}/assign`
  }
  return staticBackRoute(routeName)
}
