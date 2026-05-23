import { reactive, computed, provide, inject, unref } from 'vue'
import { createEmptyRoom, createMockReceiptItems, createDemoRoom } from './useMockRoom'
import { mockScanTaxMeta } from './parseReceiptMock'
import { isFeeLikeKind, isAssignableKind } from '../constants/items'
import { syncRoomDueState, unpaidTotal, isPastDue } from './useDueDate'
import {
  hydrateRoomsFromStorage,
  saveMyBill,
  getMyAccessList,
  getMyRoomsFromStorage,
  getHostBills,
} from './useMyBills'
import { registerHostRoom } from './useHostCookie'

const ROOM_KEY = Symbol('roomState')

const demoRoom = createDemoRoom()
syncRoomDueState(demoRoom)

const state = reactive({
  rooms: { [demoRoom.id]: demoRoom },
  currentMemberId: null,
})

hydrateRoomsFromStorage(state)

export function getRoomById(id) {
  return state.rooms[id] || null
}

function persist(room, roleOverride) {
  if (!room) return
  const role =
    roleOverride ||
    (state.currentMemberId === 'host' || !state.currentMemberId
      ? 'host'
      : 'member')
  const memberId = role === 'host' ? null : state.currentMemberId
  saveMyBill(room, { role, memberId })
}

function migrateHostAssignment(item) {
  if (item.assignedTo?.includes('host') && item.hostQuantity == null) {
    item.hostQuantity = item.quantity
  }
  item.assignedTo = (item.assignedTo || []).filter((id) => id !== 'host')
}

function normalizeItem(item) {
  item.quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))
  if (item.unitPrice == null) item.unitPrice = Number(item.price) || 0
  if (!isFeeLikeKind(item.kind) && item.taxRate == null) item.taxRate = 0
  if (isFeeLikeKind(item.kind)) item.taxRate = 0
  migrateHostAssignment(item)
  const maxHost = item.quantity
  item.hostQuantity = Math.min(
    maxHost,
    Math.max(0, Math.floor(Number(item.hostQuantity) || 0)),
  )
  if (itemMemberQuantity(item) <= 0) {
    item.assignedTo = []
  }
  item.price = itemLineTotal(item)
}

export function itemHostQuantity(item) {
  if (!item) return 0
  const qty = Math.max(1, Math.floor(Number(item.quantity) || 1))
  return Math.min(qty, Math.max(0, Math.floor(Number(item.hostQuantity) || 0)))
}

export function itemMemberQuantity(item) {
  if (!item) return 0
  return Math.max(0, item.quantity - itemHostQuantity(item))
}

export function itemLineSubtotal(item) {
  const qty = Math.max(1, Math.floor(Number(item?.quantity) || 1))
  const unit = Number(item?.unitPrice ?? item?.price ?? 0)
  return Math.round(unit * qty * 100) / 100
}

/** SST / tax on a menu line (from scan or edited on review). */
export function itemLineTax(item) {
  if (!item || isFeeLikeKind(item.kind)) return 0
  if (item.taxAmount != null && item.taxAmount !== '') {
    return Math.round(Number(item.taxAmount) * 100) / 100
  }
  const base = itemLineSubtotal(item)
  const rate = Math.max(0, Number(item.taxRate) || 0)
  return Math.round(base * rate * 100) / 100
}

export function itemHostTotal(item) {
  const qty = Math.max(1, Math.floor(Number(item?.quantity) || 1))
  const ratio = itemHostQuantity(item) / qty
  return Math.round(itemLineTotal(item) * ratio * 100) / 100
}

export function itemMemberPoolTotal(item) {
  const qty = Math.max(1, Math.floor(Number(item?.quantity) || 1))
  const ratio = itemMemberQuantity(item) / qty
  return Math.round(itemLineTotal(item) * ratio * 100) / 100
}

function memberShareForItem(item, memberId) {
  if (!item.assignedTo.includes(memberId) || itemMemberQuantity(item) <= 0) return 0
  const assignees = item.assignedTo.filter((id) => id !== 'host')
  if (!assignees.length) return 0
  const pool = itemMemberPoolTotal(item)
  return Math.round((pool / assignees.length) * 100) / 100
}

function isMenuKind(kind) {
  return kind === 'food' || kind === 'drink'
}

function migrateFeeRoles(room) {
  room?.items?.forEach((item) => {
    if (item.feeRole) return
    if (item.kind === 'fee' && /service charge/i.test(item.name ?? '')) {
      item.feeRole = 'serviceCharge'
    }
  })
}

function recalcServiceChargeLine(room) {
  if (!room?.items?.length) return
  const rate = Math.max(0, Number(room.scannedServiceRate) || 0)
  const base = billMenuBase(room)
  room.items.forEach((item) => {
    if (item.feeRole === 'serviceCharge' && !item.serviceChargeManual) {
      item.unitPrice = Math.round(base * rate * 100) / 100
      item.name = `Service charge (${Math.round(rate * 1000) / 10}%)`
      normalizeItem(item)
    }
  })
}

function maybeRecalcServiceAfterMenuChange(room, changedItem) {
  if (changedItem && isFeeLikeKind(changedItem.kind)) return
  recalcServiceChargeLine(room)
}

export function billSubtotal(room) {
  if (!room?.items?.length) return 0
  return room.items.reduce((sum, item) => sum + itemLineTotal(item), 0)
}

export function billHostTotal(room) {
  if (!room?.items?.length) return 0
  return room.items.reduce((sum, item) => sum + itemHostTotal(item), 0)
}

export function billMemberPool(room) {
  return Math.max(0, billSubtotal(room) - billHostTotal(room))
}

export function billMenuBase(room) {
  if (!room?.items?.length) return 0
  return room.items
    .filter((i) => !isFeeLikeKind(i.kind))
    .reduce((sum, item) => sum + itemLineSubtotal(item), 0)
}

export function billScannedLineTax(room) {
  if (!room?.items?.length) return 0
  return room.items
    .filter((i) => !isFeeLikeKind(i.kind))
    .reduce((sum, item) => sum + itemLineTax(item), 0)
}

export function billFeeLinesTotal(room) {
  if (!room?.items?.length) return 0
  return room.items
    .filter((i) => isFeeLikeKind(i.kind))
    .reduce((sum, item) => sum + itemLineTotal(item), 0)
}

function normalizeRoomItems(room) {
  room?.items?.forEach((item) => {
    if (!item.kind) item.kind = 'food'
    normalizeItem(item)
  })
}

function normalizeRoom(room) {
  if (!room) return
  if (room.taxFromScan == null) room.taxFromScan = false
  if (room.scannedSstRate == null) room.scannedSstRate = 0.06
  if (room.scannedServiceRate == null) room.scannedServiceRate = 0.1
  migrateFeeRoles(room)
  normalizeRoomItems(room)
}

export function itemLineTotal(item) {
  if (isFeeLikeKind(item?.kind)) return itemLineSubtotal(item)
  return Math.round((itemLineSubtotal(item) + itemLineTax(item)) * 100) / 100
}

function recalcAmounts(room) {
  if (!room?.splitMode) return
  normalizeRoom(room)
  const members = room.members.filter((m) => !m.isHost)
  const memberPool = billMemberPool(room)

  if (room.splitMode === 'equal') {
    const share = members.length ? memberPool / members.length : 0
    members.forEach((m) => {
      m.amountDue = Math.round(share * 100) / 100
    })
    return
  }

  const menuItems = room.items.filter((i) => isAssignableKind(i.kind))
  const feeItems = room.items.filter((i) => isFeeLikeKind(i.kind))

  const menuDueByMember = Object.fromEntries(
    members.map((m) => [
      m.id,
      menuItems.reduce((sum, item) => sum + memberShareForItem(item, m.id), 0),
    ]),
  )
  const totalMenuDue = Object.values(menuDueByMember).reduce((s, v) => s + v, 0)

  members.forEach((m) => {
    const menuDue = menuDueByMember[m.id] ?? 0
    let feeDue = 0

    if (totalMenuDue > 0) {
      for (const feeItem of feeItems) {
        const pool = itemMemberPoolTotal(feeItem)
        if (pool <= 0) continue
        feeDue += pool * (menuDue / totalMenuDue)
      }
    }

    m.amountDue = Math.round((menuDue + feeDue) * 100) / 100
  })
}

function refreshDue(room) {
  syncRoomDueState(room)
  if (room?.isOverdue && unpaidTotal(room) > 0 && room.status === 'open') {
    room.status = 'overdue'
  }
}

export function useRoomStateProvider() {
  normalizeRoom(demoRoom)
  for (const room of Object.values(state.rooms)) {
    normalizeRoom(room)
  }

  provide(ROOM_KEY, {
    state,
    getRoom: (id) => state.rooms[id],
    getCompletedRooms: () => Object.values(state.rooms).filter((r) => r.status === 'completed'),
    getMyBills: () => getMyRoomsFromStorage(state),
    getHostBills: () => getHostBills(state),
    getMyAccessList,
    createRoom: ({ name, hostName, hostEmail, dueDate }) => {
      const id = Math.random().toString(36).slice(2, 8)
      const room = createEmptyRoom({ id, name, hostName, hostEmail, dueDate })
      state.rooms[id] = room
      state.currentMemberId = 'host'
      registerHostRoom(id)
      persist(room, 'host')
      return room
    },
    setReceiptImage: (roomId, url) => {
      const room = state.rooms[roomId]
      if (room) {
        room.receiptImageUrl = url
        room.status = 'uploaded'
        persist(room, 'host')
      }
    },
    loadReceiptMock: (roomId) => {
      const room = state.rooms[roomId]
      if (!room) return
      room.status = 'scanning'
      persist(room, 'host')
      setTimeout(() => {
        room.items = createMockReceiptItems()
        Object.assign(room, mockScanTaxMeta())
        normalizeRoom(room)
        room.status = 'split_mode'
        persist(room, 'host')
      }, 600)
    },
    setSplitMode: (roomId, mode) => {
      const room = state.rooms[roomId]
      if (!room) return
      room.splitMode = mode
      persist(room, 'host')
      if (mode === 'equal') {
        room.items.forEach((item) => {
          item.assignedTo = []
        })
      }
      recalcAmounts(room)
    },
    confirmSplitMode: (roomId) => {
      const room = state.rooms[roomId]
      if (room && room.splitMode) {
        room.status = 'review'
        persist(room, 'host')
      }
    },
    updateItem: (roomId, itemId, patch) => {
      const room = state.rooms[roomId]
      const item = room?.items.find((i) => i.id === itemId)
      if (!item) return
      if (item.feeRole === 'serviceCharge' && 'unitPrice' in patch) {
        item.serviceChargeManual = true
      }
      Object.assign(item, patch)
      normalizeItem(item)
      maybeRecalcServiceAfterMenuChange(room, item)
      recalcAmounts(room)
      persist(room, 'host')
    },
    removeItem: (roomId, itemId) => {
      const room = state.rooms[roomId]
      if (!room) return
      const removed = room.items.find((i) => i.id === itemId)
      room.items = room.items.filter((i) => i.id !== itemId)
      maybeRecalcServiceAfterMenuChange(room, removed)
      recalcAmounts(room)
      persist(room, 'host')
    },
    addItem: (roomId, { name, unitPrice, quantity = 1, kind = 'food' }) => {
      const room = state.rooms[roomId]
      if (!room || !String(name).trim()) return null
      const feeLike = isFeeLikeKind(kind)
      const item = {
        id: `i-${Math.random().toString(36).slice(2, 8)}`,
        name: String(name).trim(),
        kind,
        unitPrice: Math.max(0, Number(unitPrice) || 0),
        quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
        taxRate: feeLike ? 0 : (room.scannedSstRate ?? 0),
        taxFromScan: false,
        hostQuantity: 0,
        assignedTo: [],
        price: 0,
      }
      normalizeItem(item)
      room.items.push(item)
      maybeRecalcServiceAfterMenuChange(room, item)
      recalcAmounts(room)
      persist(room, 'host')
      return item
    },
    setScannedSstRate: (roomId, rate) => {
      const room = state.rooms[roomId]
      if (!room) return
      const pct = Math.max(0, Math.min(1, Number(rate) || 0))
      room.scannedSstRate = pct
      room.items.forEach((item) => {
        if (isMenuKind(item.kind)) {
          item.taxRate = pct
          normalizeItem(item)
        }
      })
      recalcAmounts(room)
      persist(room, 'host')
    },
    setScannedServiceRate: (roomId, rate) => {
      const room = state.rooms[roomId]
      if (!room) return
      const pct = Math.max(0, Math.min(1, Number(rate) || 0))
      room.scannedServiceRate = pct
      let line = room.items.find((i) => i.feeRole === 'serviceCharge')
      if (!line) {
        line = {
          id: `fee-sc-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'fee',
          feeRole: 'serviceCharge',
          taxFromScan: false,
          quantity: 1,
          taxRate: 0,
          hostQuantity: 0,
          assignedTo: [],
          unitPrice: 0,
          price: 0,
          name: '',
        }
        room.items.push(line)
      }
      line.serviceChargeManual = false
      recalcServiceChargeLine(room)
      recalcAmounts(room)
      persist(room, 'host')
    },
    addTaxLine: (roomId, { name, unitPrice, kind = 'tax' }) => {
      const room = state.rooms[roomId]
      if (!room || !String(name).trim()) return null
      const item = {
        id: `tax-${Math.random().toString(36).slice(2, 8)}`,
        name: String(name).trim(),
        kind: isFeeLikeKind(kind) ? kind : 'tax',
        unitPrice: Math.max(0, Number(unitPrice) || 0),
        quantity: 1,
        taxRate: 0,
        taxFromScan: false,
        hostQuantity: 0,
        assignedTo: [],
        price: 0,
      }
      normalizeItem(item)
      room.items.push(item)
      recalcAmounts(room)
      persist(room, 'host')
      return item
    },
    resetServiceChargeManual: (roomId) => {
      const room = state.rooms[roomId]
      if (!room) return
      const line = room.items.find((i) => i.feeRole === 'serviceCharge')
      if (line) {
        line.serviceChargeManual = false
        recalcServiceChargeLine(room)
        recalcAmounts(room)
        persist(room, 'host')
      }
    },
    setHostQuantity: (roomId, itemId, hostQty) => {
      const room = state.rooms[roomId]
      const item = room?.items.find((i) => i.id === itemId)
      if (!item) return
      normalizeItem(item)
      item.hostQuantity = Math.min(item.quantity, Math.max(0, Math.floor(hostQty)))
      normalizeItem(item)
      recalcAmounts(room)
      persist(room, 'host')
    },
    confirmReceipt: (roomId) => {
      const room = state.rooms[roomId]
      if (room) {
        room.status = 'payment_setup'
        recalcAmounts(room)
        persist(room, 'host')
      }
    },
    setPaymentMethod: (roomId, patch) => {
      const room = state.rooms[roomId]
      if (room) Object.assign(room.paymentMethod, patch)
    },
    openRoom: (roomId) => {
      const room = state.rooms[roomId]
      if (room) {
        room.status = 'open'
        refreshDue(room)
        persist(room, 'host')
      }
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
      persist(room, 'member')
      return id
    },
    toggleItemAssignment: (roomId, itemId, memberId) => {
      const room = state.rooms[roomId]
      const item = room?.items.find((i) => i.id === itemId)
      if (!item || !isAssignableKind(item.kind) || itemMemberQuantity(item) <= 0) return
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
        persist(room)
      }
      refreshDue(room)
    },
    confirmPayment: (roomId, memberId) => {
      const room = state.rooms[roomId]
      const member = room?.members.find((m) => m.id === memberId)
      if (member) {
        member.confirmed = true
        persist(room)
      }
      refreshDue(room)
    },
    checkDueDate: (roomId) => {
      const room = state.rooms[roomId]
      refreshDue(room)
      return room
    },
    completeRoom: (roomId) => {
      const room = state.rooms[roomId]
      if (room) {
        room.status = 'completed'
        room.completedAt = new Date().toISOString()
        persist(room, 'host')
      }
    },
    recalcAmounts,
    itemLineTotal,
    itemLineSubtotal,
    itemLineTax,
    billMenuBase,
    billScannedLineTax,
    billFeeLinesTotal,
    itemHostQuantity,
    itemMemberQuantity,
    itemHostTotal,
    itemMemberPoolTotal,
    billSubtotal,
    billHostTotal,
    billMemberPool,
    unpaidTotal,
    isPastDue,
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
