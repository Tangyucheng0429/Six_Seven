import { reactive, computed, provide, inject, unref } from 'vue'
import { createEmptyRoom, createMockReceiptItems, createDemoRoom } from './useMockRoom'

const ROOM_KEY = Symbol('roomState')

const demoRoom = createDemoRoom()
const state = reactive({
  rooms: { [demoRoom.id]: demoRoom },
  currentMemberId: null,
})

function recalcAmounts(room) {
  const members = room.members.filter((m) => !m.isHost)
  const total = room.items.reduce((sum, item) => sum + item.price, 0)

  if (room.splitMode === 'equal') {
    const share = members.length ? total / members.length : 0
    members.forEach((m) => {
      m.amountDue = Math.round(share * 100) / 100
    })
    return
  }

  members.forEach((m) => {
    m.amountDue = room.items
      .filter((item) => item.assignedTo.includes(m.id))
      .reduce((sum, item) => sum + item.price, 0)
  })
}

export function useRoomStateProvider() {
  provide(ROOM_KEY, {
    state,
    getRoom: (id) => state.rooms[id],
    createRoom: ({ name, hostName }) => {
      const id = Math.random().toString(36).slice(2, 8)
      const room = createEmptyRoom({ id, name, hostName })
      state.rooms[id] = room
      state.currentMemberId = 'host'
      return room
    },
    loadReceiptMock: (roomId) => {
      const room = state.rooms[roomId]
      if (!room) return
      room.items = createMockReceiptItems()
      room.status = 'review'
      recalcAmounts(room)
    },
    setReceiptImage: (roomId, url) => {
      const room = state.rooms[roomId]
      if (room) room.receiptImageUrl = url
    },
    updateItem: (roomId, itemId, patch) => {
      const room = state.rooms[roomId]
      const item = room?.items.find((i) => i.id === itemId)
      if (item) Object.assign(item, patch)
      recalcAmounts(room)
    },
    setSplitMode: (roomId, mode) => {
      const room = state.rooms[roomId]
      if (!room) return
      room.splitMode = mode
      if (mode === 'equal') {
        room.items.forEach((item) => {
          item.assignedTo = []
        })
      }
      recalcAmounts(room)
    },
    confirmReceipt: (roomId) => {
      const room = state.rooms[roomId]
      if (room) {
        room.status = 'payment_setup'
        recalcAmounts(room)
      }
    },
    setPaymentMethod: (roomId, patch) => {
      const room = state.rooms[roomId]
      if (room) Object.assign(room.paymentMethod, patch)
    },
    openRoom: (roomId) => {
      const room = state.rooms[roomId]
      if (room) room.status = 'open'
    },
    joinRoom: (roomId, memberName) => {
      const room = state.rooms[roomId]
      if (!room) return null
      const id = `m-${Math.random().toString(36).slice(2, 6)}`
      room.members.push({
        id,
        name: memberName,
        isHost: false,
        amountDue: 0,
        paid: false,
        confirmed: false,
        proofUrl: null,
      })
      state.currentMemberId = id
      recalcAmounts(room)
      return id
    },
    toggleItemAssignment: (roomId, itemId, memberId) => {
      const room = state.rooms[roomId]
      const item = room?.items.find((i) => i.id === itemId)
      if (!item) return
      const idx = item.assignedTo.indexOf(memberId)
      if (idx >= 0) item.assignedTo.splice(idx, 1)
      else item.assignedTo.push(memberId)
      recalcAmounts(room)
    },
    markPaid: (roomId, memberId, proofUrl = null) => {
      const room = state.rooms[roomId]
      const member = room?.members.find((m) => m.id === memberId)
      if (member) {
        member.paid = true
        member.proofUrl = proofUrl
      }
    },
    confirmPayment: (roomId, memberId) => {
      const room = state.rooms[roomId]
      const member = room?.members.find((m) => m.id === memberId)
      if (member) member.confirmed = true
    },
    completeRoom: (roomId) => {
      const room = state.rooms[roomId]
      if (room) room.status = 'completed'
    },
    recalcAmounts,
  })
}

export function useRoomState() {
  const ctx = inject(ROOM_KEY)
  if (!ctx) throw new Error('useRoomState must be used inside provider')
  return ctx
}

export function useRoom(roomId) {
  const { getRoom } = useRoomState()
  return computed(() => getRoom(unref(roomId)) || null)
}

export function formatMYR(amount) {
  return `RM ${Number(amount).toFixed(2)}`
}
