import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import CreateRoomView from '../views/CreateRoomView.vue'
import EnterRoomView from '../views/EnterRoomView.vue'
import UploadReceiptView from '../views/UploadReceiptView.vue'
import ScanReceiptView from '../views/ScanReceiptView.vue'
import SplitModeView from '../views/SplitModeView.vue'
import ReviewReceiptView from '../views/ReviewReceiptView.vue'
import PaymentSetupView from '../views/PaymentSetupView.vue'
import HostDashboardView from '../views/HostDashboardView.vue'
import JoinView from '../views/JoinView.vue'
import AssignItemsView from '../views/AssignItemsView.vue'
import MemberPayView from '../views/MemberPayView.vue'
import MemberDoneView from '../views/MemberDoneView.vue'
import HistoryView from '../views/HistoryView.vue'
import { getRoomById, getActiveMemberId } from '../composables/useRoomState'
import { isHostOfRoom } from '../composables/useHostCookie'
import {
  isRoomCode,
  hostPathForRouteName,
  hostRoomPath,
  memberPathForRouteName,
  memberRoomPath,
} from '../composables/roomPaths'
import {
  hostRouteForStatus,
  isHostDashboardStatus,
  hostRouteIndex,
  hostMaxAllowedRouteIndex,
} from '../constants/flows'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/create', name: 'create', component: CreateRoomView },
    { path: '/enter-room', name: 'enter-room', component: EnterRoomView },
    { path: '/history', name: 'history', component: HistoryView },
    { path: '/room/:id/upload', name: 'upload', component: UploadReceiptView },
    { path: '/room/:id/scan', name: 'scan', component: ScanReceiptView },
    { path: '/room/:id/split-mode', name: 'split-mode', component: SplitModeView },
    { path: '/room/:id/review', name: 'review', component: ReviewReceiptView },
    { path: '/room/:id/payment-setup', name: 'payment-setup', component: PaymentSetupView },
    { path: '/room/:id', name: 'dashboard', component: HostDashboardView },
    { path: '/join/:token', name: 'join', component: JoinView },
    { path: '/room/:id/assign', name: 'assign', component: AssignItemsView },
    { path: '/room/:id/pay', name: 'pay', component: MemberPayView },
    { path: '/room/:id/done', name: 'member-done', component: MemberDoneView },
  ],
})

const HOST_STEP_ROUTES = new Set([
  'upload',
  'scan',
  'split-mode',
  'review',
  'payment-setup',
  'dashboard',
])

const MEMBER_ROUTES = new Set(['assign', 'pay', 'member-done'])

router.beforeEach((to) => {
  const roomId = to.params.id

  if (roomId && MEMBER_ROUTES.has(to.name)) {
    const room = getRoomById(roomId)
    if (room) {
      const code = room.roomCode || room.inviteToken
      const slug = code && isRoomCode(code) ? String(code).toUpperCase() : null

      if (slug && String(roomId).toUpperCase() !== slug) {
        const canonical = memberPathForRouteName(room, to.name)
        if (canonical) return canonical
      }

      const memberId = getActiveMemberId()
      if (isHostOfRoom(room, memberId)) {
        return hostRoomPath(room, 'dashboard')
      }

      if (room.status !== 'open' && room.status !== 'overdue') {
        return code ? `/join/${code}` : '/enter-room'
      }
      if (to.name === 'assign' && room.splitMode === 'equal') {
        return memberRoomPath(room, 'pay')
      }
      const payerId = getActiveMemberId()
      const member = payerId ? room.members?.find((m) => m.id === payerId && !m.isHost) : null
      if ((member?.confirmed || member?.paid) && to.name !== 'member-done') {
        return memberRoomPath(room, 'done')
      }
    }
  }

  if (!roomId || !HOST_STEP_ROUTES.has(to.name)) {
    return true
  }

  const room = getRoomById(roomId)
  if (!room) {
    return true
  }

  const code = room.roomCode || room.inviteToken
  const slug = code && isRoomCode(code) ? String(code).toUpperCase() : null
  if (slug && String(roomId).toUpperCase() !== slug) {
    const canonical = hostPathForRouteName(room, to.name)
    if (canonical) return canonical
  }

  if (to.name === 'dashboard' && !isHostDashboardStatus(room.status)) {
    return hostRouteForStatus(room, room.status)
  }

  const targetIndex = hostRouteIndex(to.name)
  const maxIndex = hostMaxAllowedRouteIndex(room.status)

  if (targetIndex > maxIndex) {
    return hostRouteForStatus(room, room.status)
  }

  return true
})

export default router
