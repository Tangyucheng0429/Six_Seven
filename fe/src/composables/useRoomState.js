import { reactive, computed, provide, inject, unref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hostPathForRouteName, memberPathForRouteName, roomSlug } from './roomPaths.js'
import { isRoomCode } from './roomCodes.js'
import { isFeeLikeKind, isAssignableKind } from '../constants/items'
import { syncRoomDueState, unpaidTotal, isPastDue } from './useDueDate'
import {
  hydrateRoomsFromStorage,
  saveMyBill,
  getMyAccessList,
  getMyRoomsFromStorage,
  getHostBills,
} from './useMyBills'
import { registerHostRoom, isHostOfRoom } from './useHostCookie'
import { assertApiConfigured } from '../api/client.js'
import {
  apiCreateRoom,
  apiFetchRoom,
  apiFetchRoomByCode,
  apiJoinRoom,
  apiUploadAndScan,
  apiVerifyReceipt,
  apiPublishRoom,
  apiVerifyMemberPayment,
  apiSaveMemberAssignments,
  apiSubmitPaymentProof,
  setPendingReceiptFile,
  setPendingQrFile,
  setPendingProofFile,
  migratePendingReceiptKey,
} from './useRoomApi.js'

const ROOM_KEY = Symbol('roomState')

const state = reactive({
  rooms: {},
  currentMemberId: null,
  roomLoading: {},
  roomError: {},
})

hydrateRoomsFromStorage(state)

const WIZARD_STATUSES = [
  'draft',
  'uploaded',
  'scanning',
  'split_mode',
  'review',
  'payment_setup',
  'open',
  'overdue',
  'completed',
]

function wizardStatusIndex(status) {
  const i = WIZARD_STATUSES.indexOf(status)
  return i >= 0 ? i : 0
}

/** Keep local wizard progress when a background fetch returns an earlier step. */
function mergeRoomFromExisting(incoming, existing) {
  if (!incoming || !existing) return incoming

  if (wizardStatusIndex(existing.status) > wizardStatusIndex(incoming.status)) {
    incoming.status = existing.status
  }
  if (existing.splitConfirmed) incoming.splitConfirmed = true
  if (existing.splitMode) incoming.splitMode = existing.splitMode
  if (existing.equalHeadcount != null) incoming.equalHeadcount = existing.equalHeadcount
  if (existing.equalHostParticipates != null) {
    incoming.equalHostParticipates = existing.equalHostParticipates
  }

  if (existing.receiptImageUrl?.startsWith('blob:')) {
    incoming.receiptImageUrl = existing.receiptImageUrl
  }

  // hostQuantity / memberClaims always come from the API (item_assignments), not stale localStorage.

  return incoming
}

function applyRoom(room, roleOverride) {
  if (!room?.id) return
  const existing = state.rooms[room.id]
  mergeRoomFromExisting(room, existing)
  safeNormalizeRoom(room)
  state.rooms[room.id] = room
  persist(room, roleOverride)
}

async function withRoomError(roomId, fn) {
  state.roomError[roomId] = null
  state.roomLoading[roomId] = true
  try {
    return await fn()
  } catch (err) {
    state.roomError[roomId] = err?.message || 'Request failed'
    throw err
  } finally {
    state.roomLoading[roomId] = false
  }
}

export function getRoomById(id) {
  if (!id) return null
  const direct = state.rooms[id]
  if (direct) return direct
  const key = String(id).toLowerCase()
  return (
    Object.values(state.rooms).find((r) => r.roomCode?.toLowerCase() === key) || null
  )
}

export function getActiveMemberId() {
  return state.currentMemberId
}

/** Clear member session when acting as host (avoids member /done UI for host). */
export function clearMemberSessionIfHost(room) {
  if (!room) return
  const id = state.currentMemberId
  if (id && isHostOfRoom(room, id)) {
    state.currentMemberId = null
  }
}

/** Resolve route param or room code to DB room_id for API calls. */
export async function resolveRoomIdForApi(param) {
  const trimmed = String(param || '').trim()
  if (!trimmed) return trimmed
  const cached = getRoomById(trimmed)
  if (cached?.id) return cached.id
  if (isRoomCode(trimmed)) {
    const room = await apiFetchRoomByCode(trimmed.toUpperCase())
    cacheRoom(room)
    return room.id
  }
  return trimmed
}

function roomFromParam(param) {
  return getRoomById(param) || state.rooms[param] || null
}

function resolvePersistRole(roleOverride) {
  if (roleOverride) return roleOverride
  if (state.currentMemberId && state.currentMemberId !== 'host') return 'member'
  return 'host'
}

function persist(room, roleOverride) {
  if (!room) return
  const role = resolvePersistRole(roleOverride)
  const memberId = role === 'host' ? null : state.currentMemberId
  saveMyBill(room, { role, memberId })
}

function cacheRoom(room) {
  if (!room?.id) return
  const existing = state.rooms[room.id]
  mergeRoomFromExisting(room, existing)
  safeNormalizeRoom(room)
  state.rooms[room.id] = room
}

function migrateHostAssignment(item) {
  if (item.assignedTo?.includes('host') && item.hostQuantity == null) {
    item.hostQuantity = item.quantity
  }
  item.assignedTo = (item.assignedTo || []).filter((id) => id !== 'host')
}

function ensureMemberClaims(item) {
  if (!item.memberClaims || typeof item.memberClaims !== 'object' || Array.isArray(item.memberClaims)) {
    item.memberClaims = {}
  }
}

function syncAssignedToFromClaims(item) {
  ensureMemberClaims(item)
  item.assignedTo = Object.entries(item.memberClaims)
    .filter(([, qty]) => Math.floor(Number(qty) || 0) > 0)
    .map(([id]) => id)
}

function migrateMemberClaimsFromAssignedTo(item) {
  ensureMemberClaims(item)
  if (totalMemberClaims(item) > 0) return
  const assignees = (item.assignedTo || []).filter((id) => id !== 'host')
  assignees.forEach((id) => {
    item.memberClaims[id] = 1
  })
}

function capMemberClaims(item) {
  ensureMemberClaims(item)
  const max = itemMemberQuantity(item)
  if (max <= 0) {
    item.memberClaims = {}
    item.assignedTo = []
    return
  }
  let total = totalMemberClaims(item)
  if (total <= max) return
  const entries = Object.entries(item.memberClaims)
    .map(([id, qty]) => [id, Math.floor(Number(qty) || 0)])
    .filter(([, qty]) => qty > 0)
    .sort((a, b) => b[1] - a[1])
  while (total > max && entries.length) {
    const [id, qty] = entries[0]
    const next = qty - 1
    if (next <= 0) {
      delete item.memberClaims[id]
      entries.shift()
    } else {
      item.memberClaims[id] = next
      entries[0][1] = next
      entries.sort((a, b) => b[1] - a[1])
    }
    total--
  }
}

export function getMemberClaim(item, memberId) {
  if (!item?.memberClaims || !memberId) return 0
  return Math.max(0, Math.floor(Number(item.memberClaims[memberId]) || 0))
}

export function totalMemberClaims(item) {
  if (!item?.memberClaims) return 0
  return Object.values(item.memberClaims).reduce(
    (sum, qty) => sum + Math.max(0, Math.floor(Number(qty) || 0)),
    0,
  )
}

export function remainingMemberQty(item) {
  return Math.max(0, itemMemberQuantity(item) - totalMemberClaims(item))
}

/** Qty claimed by other members (excludes current member and host). */
export function othersClaimedQty(item, memberId) {
  if (!item?.memberClaims || !memberId) return 0
  return Object.entries(item.memberClaims).reduce((sum, [id, qty]) => {
    if (id === memberId) return sum
    const m = Math.max(0, Math.floor(Number(qty) || 0))
    return sum + m
  }, 0)
}

export function otherClaimants(item, room, memberId) {
  if (!item?.memberClaims || !room?.members) return []
  return Object.entries(item.memberClaims)
    .filter(([id, qty]) => id !== memberId && Math.floor(Number(qty) || 0) > 0)
    .map(([id, qty]) => {
      const name = room.members.find((m) => m.id === id)?.name || 'Member'
      const q = Math.floor(Number(qty) || 0)
      return { id, name, qty: q }
    })
}

function normalizeMemberClaims(item) {
  ensureMemberClaims(item)
  for (const id of Object.keys(item.memberClaims)) {
    const qty = Math.max(0, Math.floor(Number(item.memberClaims[id]) || 0))
    if (qty <= 0) delete item.memberClaims[id]
    else item.memberClaims[id] = qty
  }
}

function normalizeItem(item) {
  if (!item || typeof item !== 'object') return
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
    item.memberClaims = {}
    item.assignedTo = []
  } else {
    normalizeMemberClaims(item)
    capMemberClaims(item)
    syncAssignedToFromClaims(item)
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

export function memberShareForItem(item, memberId) {
  if (itemMemberQuantity(item) <= 0) return 0
  const claim = getMemberClaim(item, memberId)
  const totalClaims = totalMemberClaims(item)
  if (!claim || totalClaims <= 0) return 0
  const pool = itemMemberPoolTotal(item)
  return Math.round(pool * (claim / totalClaims) * 100) / 100
}

/** Line-by-line breakdown for member pay screen (matches recalcAmounts). */
export function getMemberPayBreakdown(room, memberId) {
  const member = room?.members?.find((m) => m.id === memberId)
  if (!room || !member) return null

  if (room.splitMode === 'equal') {
    const payers = room.members.filter((m) => !m.isHost)
    const headcount = equalSplitPayerCount(room)
    const menuLines = billMenuLines(room)
    const feeLines = billFeeDisplayLines(room)
    const billTotal = billSubtotal(room)
    return {
      mode: 'equal',
      total: member.amountDue ?? equalSplitShareAmount(room),
      memberCount: payers.length || headcount,
      headcount,
      hostParticipates: room.equalHostParticipates !== false,
      menuLines,
      feeLines,
      billTotal,
      menuSubtotal: Math.round(menuLines.reduce((s, l) => s + l.amount, 0) * 100) / 100,
    }
  }

  const menuItems = room.items.filter((i) => isAssignableKind(i.kind))
  const feeItems = room.items.filter((i) => isFeeLikeKind(i.kind))
  const payers = room.members.filter((m) => !m.isHost)

  const menuDueByMember = Object.fromEntries(
    payers.map((m) => [
      m.id,
      menuItems.reduce((sum, item) => sum + memberShareForItem(item, m.id), 0),
    ]),
  )
  const totalMenuDue = Object.values(menuDueByMember).reduce((s, v) => s + v, 0)
  const menuDue = menuDueByMember[memberId] ?? 0

  const menuLines = menuItems
    .map((item) => {
      const qty = getMemberClaim(item, memberId)
      const amount = memberShareForItem(item, memberId)
      if (qty <= 0 && amount <= 0) return null
      return {
        id: item.id,
        name: item.name,
        qty,
        amount,
      }
    })
    .filter(Boolean)

  const feeLines = []
  let feeTotal = 0
  if (totalMenuDue > 0 && menuDue > 0) {
    for (const feeItem of feeItems) {
      const pool = itemMemberPoolTotal(feeItem)
      if (pool <= 0) continue
      const amount = Math.round(pool * (menuDue / totalMenuDue) * 100) / 100
      if (amount > 0) {
        feeLines.push({ name: feeItem.name, amount })
        feeTotal += amount
      }
    }
    feeTotal = Math.round(feeTotal * 100) / 100
  }

  const menuSubtotal = Math.round(menuLines.reduce((s, line) => s + line.amount, 0) * 100) / 100

  const computedTotal = Math.round((menuSubtotal + feeTotal) * 100) / 100
  const serverDue = Number(member.amountDue)
  const total =
    Number.isFinite(serverDue) && serverDue > 0 ? serverDue : computedTotal

  return {
    mode: 'item',
    menuLines,
    menuSubtotal,
    feeLines,
    feeTotal,
    total,
    serverAmount: Number.isFinite(serverDue) ? serverDue : null,
  }
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
  if (room?.splitMode === 'equal') return billSubtotal(room)
  return Math.max(0, billSubtotal(room) - billHostTotal(room))
}

export function equalSplitPayerCount(room) {
  return Math.max(1, Math.min(99, Math.floor(Number(room?.equalHeadcount) || 1)))
}

/** Slots for non-host members in equal split (invite capacity). */
export function equalSplitMemberCapacity(room) {
  if (room?.splitMode !== 'equal') {
    return { maxMembers: Infinity, memberCount: 0, headcount: 0, hostParticipates: true, isFull: false, spotsLeft: Infinity }
  }
  const headcount = equalSplitPayerCount(room)
  const hostParticipates = room.equalHostParticipates !== false
  const maxMembers = hostParticipates ? Math.max(0, headcount - 1) : headcount
  const memberCount = (room.members || []).filter((m) => !m.isHost).length
  const spotsLeft = Math.max(0, maxMembers - memberCount)
  return {
    maxMembers,
    memberCount,
    headcount,
    hostParticipates,
    isFull: memberCount >= maxMembers,
    spotsLeft,
  }
}

export function equalSplitShareAmount(room) {
  const total = billSubtotal(room)
  const n = equalSplitPayerCount(room)
  return Math.round((total / n) * 100) / 100
}

/** All food/drink lines on the receipt (read-only display). */
export function billMenuLines(room) {
  if (!room?.items?.length) return []
  return room.items
    .filter((i) => isAssignableKind(i.kind))
    .map((item) => ({
      id: item.id,
      name: item.name,
      qty: Math.max(1, Number(item.quantity) || 1),
      amount: itemLineTotal(item),
    }))
}

export function billFeeDisplayLines(room) {
  if (!room?.items?.length) return []
  return room.items
    .filter((i) => isFeeLikeKind(i.kind))
    .map((item) => ({
      id: item.id,
      name: item.name,
      amount: itemLineTotal(item),
    }))
    .filter((line) => line.amount > 0)
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
  if (!Array.isArray(room.items)) {
    room.items = []
    return
  }
  for (let i = room.items.length - 1; i >= 0; i -= 1) {
    if (!room.items[i] || typeof room.items[i] !== 'object') {
      room.items.splice(i, 1)
    }
  }
  room.items.forEach((item) => {
    if (!item.kind) item.kind = 'food'
    if (!Array.isArray(item.assignedTo)) item.assignedTo = []
    normalizeItem(item)
  })
}

function normalizeRoom(room) {
  if (!room) return
  if (!Array.isArray(room.items)) room.items = []
  if (!Array.isArray(room.members)) room.members = []
  if (room.taxFromScan == null) room.taxFromScan = false
  if (room.scannedSstRate == null) room.scannedSstRate = 0.06
  if (room.scannedServiceRate == null) room.scannedServiceRate = 0.1
  if (room.splitMode === 'equal') {
    if (room.equalHeadcount == null) room.equalHeadcount = 2
    if (room.equalHostParticipates == null) room.equalHostParticipates = true
  }
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
    const share = equalSplitShareAmount(room)
    members.forEach((m) => {
      m.amountDue = share
    })
    const host = room.members.find((m) => m.isHost)
    if (host) {
      host.amountDue = room.equalHostParticipates !== false ? share : 0
    }
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

function safeNormalizeRoom(room) {
  if (!room) return
  try {
    normalizeRoom(room)
  } catch (err) {
    console.error('[SixSeven] Failed to normalize room', room.id, err)
  }
}

export function useRoomStateProvider() {
  assertApiConfigured()

  provide(ROOM_KEY, {
    state,
    getRoom: (id) => getRoomById(id),
    getRoomError: (id) => state.roomError[id] || null,
    isRoomLoading: (id) => Boolean(state.roomLoading[id]),
    lookupRoomByCode: async (roomCode) => {
      const code = String(roomCode || '').trim()
      if (!code) throw new Error('Room code is required')
      return withRoomError(code, async () => {
        const existing = getRoomById(code)
        const room = await apiFetchRoomByCode(code, existing || {})
        cacheRoom(room)
        return room
      })
    },
    ensureRoom: async (roomId, { refresh = false, role } = {}) => {
      if (!roomId) return null
      const cached = getRoomById(roomId)
      if (!refresh && cached) return cached
      return withRoomError(roomId, async () => {
        const apiId = cached?.id || (await resolveRoomIdForApi(roomId))
        const room = await apiFetchRoom(apiId, cached || state.rooms[apiId])
        applyRoom(room, role ?? resolvePersistRole())
        return room
      })
    },
    fetchRoom: async (roomId, { role } = {}) => {
      if (!roomId) return null
      return withRoomError(roomId, async () => {
        const cached = getRoomById(roomId)
        const apiId = cached?.id || (await resolveRoomIdForApi(roomId))
        const room = await apiFetchRoom(apiId, cached || state.rooms[apiId])
        applyRoom(room, role ?? resolvePersistRole())
        return room
      })
    },
    getCompletedRooms: () => Object.values(state.rooms).filter((r) => r.status === 'completed'),
    getMyBills: () => getMyRoomsFromStorage(state),
    getHostBills: () => getHostBills(state),
    getMyAccessList,
    restoreMemberSession: (roomId) => {
      if (state.currentMemberId) return state.currentMemberId
      const uuid = getRoomById(roomId)?.id || roomId
      const entry = getMyAccessList().find(
        (a) => a.roomId === uuid && a.role === 'member' && a.memberId,
      )
      if (entry?.memberId) {
        state.currentMemberId = entry.memberId
        return entry.memberId
      }
      return null
    },
    createRoom: async ({ name, hostName, hostEmail, dueDate }) => {
      const room = await apiCreateRoom({ name, hostName, hostEmail, dueDate })
      state.rooms[room.id] = room
      state.currentMemberId = null
      registerHostRoom(room.id)
      persist(room, 'host')
      return room
    },
    setReceiptImage: (roomId, url, file = null) => {
      const room = roomFromParam(roomId)
      if (room) {
        room.receiptImageUrl = url
        room.status = 'uploaded'
        if (file) setPendingReceiptFile(room.id, file)
        persist(room, 'host')
      }
    },
    uploadAndScanReceipt: async (roomId) => {
      const room = roomFromParam(roomId)
      if (!room) throw new Error('Room not found.')
      migratePendingReceiptKey(roomId, room.id)
      const apiId = room.id
      room.status = 'scanning'
      persist(room, 'host')
      await withRoomError(roomId, async () => {
        const updated = await apiUploadAndScan(apiId)
        applyRoom(updated, 'host')
      })
    },
    setSplitMode: (roomId, mode) => {
      const room = roomFromParam(roomId)
      if (!room) return
      room.splitMode = mode
      persist(room, 'host')
      if (mode === 'equal') {
        if (room.equalHeadcount == null) room.equalHeadcount = 2
        if (room.equalHostParticipates == null) room.equalHostParticipates = true
        room.items.forEach((item) => {
          item.assignedTo = []
          item.memberClaims = {}
          item.hostQuantity = 0
        })
      }
      recalcAmounts(room)
    },
    setEqualSplitSettings: (roomId, { headcount, hostParticipates } = {}) => {
      const room = roomFromParam(roomId)
      if (!room || room.splitMode !== 'equal') return
      if (headcount != null) {
        room.equalHeadcount = Math.max(1, Math.min(99, Math.floor(Number(headcount) || 1)))
      }
      if (hostParticipates != null) room.equalHostParticipates = Boolean(hostParticipates)
      recalcAmounts(room)
      persist(room, 'host')
    },
    confirmSplitMode: (roomId) => {
      const room = roomFromParam(roomId)
      if (room && room.splitMode) {
        room.splitConfirmed = true
        room.status = 'review'
        persist(room, 'host')
      }
    },
    updateItem: (roomId, itemId, patch) => {
      const room = roomFromParam(roomId)
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
      const room = roomFromParam(roomId)
      if (!room) return
      const removed = room.items.find((i) => i.id === itemId)
      room.items = room.items.filter((i) => i.id !== itemId)
      maybeRecalcServiceAfterMenuChange(room, removed)
      recalcAmounts(room)
      persist(room, 'host')
    },
    addItem: (roomId, { name, unitPrice, quantity = 1, kind = 'food' }) => {
      const room = roomFromParam(roomId)
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
        memberClaims: {},
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
      const room = roomFromParam(roomId)
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
      const room = roomFromParam(roomId)
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
          memberClaims: {},
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
      const room = roomFromParam(roomId)
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
        memberClaims: {},
        price: 0,
      }
      normalizeItem(item)
      room.items.push(item)
      recalcAmounts(room)
      persist(room, 'host')
      return item
    },
    resetServiceChargeManual: (roomId) => {
      const room = roomFromParam(roomId)
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
      const room = roomFromParam(roomId)
      const item = room?.items.find((i) => i.id === itemId)
      if (!item) return
      normalizeItem(item)
      item.hostQuantity = Math.min(item.quantity, Math.max(0, Math.floor(hostQty)))
      normalizeItem(item)
      recalcAmounts(room)
      persist(room, 'host')
    },
    confirmReceipt: async (roomId) => {
      const room = roomFromParam(roomId)
      if (!room) return
      recalcAmounts(room)
      await withRoomError(roomId, async () => {
        const updated = await apiVerifyReceipt(room)
        applyRoom(updated, 'host')
      })
    },
    setPaymentMethod: (roomId, patch, qrFile = null) => {
      const room = roomFromParam(roomId)
      if (room) Object.assign(room.paymentMethod, patch)
      if (qrFile && room) setPendingQrFile(room.id, qrFile)
    },
    publishRoom: async (roomId, { type, notes, label }) => {
      const room = roomFromParam(roomId)
      if (!room) return
      await withRoomError(roomId, async () => {
        const updated = await apiPublishRoom(room, { type, notes, label })
        updated.status = 'open'
        applyRoom(updated, 'host')
      })
    },
    openRoom: (roomId) => {
      const room = roomFromParam(roomId)
      if (room) {
        room.status = 'open'
        refreshDue(room)
        persist(room, 'host')
      }
    },
    joinRoom: async (roomCode, memberName) => {
      const code = String(roomCode || '').trim()
      const res = await apiJoinRoom(code, memberName)
      const room = await apiFetchRoom(res.room_id, state.rooms[res.room_id])
      const asHost = isHostOfRoom(room, res.user_id)
      if (asHost) {
        state.currentMemberId = null
        registerHostRoom(room.id)
        applyRoom(room, 'host')
        persist(room, 'host')
      } else {
        applyRoom(room, 'member')
        state.currentMemberId = res.user_id
        persist(room, 'member')
      }
      return { userId: res.user_id, isHost: asHost, room }
    },
    saveMemberAssignments: async (roomId, memberId) => {
      const room = roomFromParam(roomId)
      if (!room || !memberId) return
      await withRoomError(roomId, async () => {
        const updated = await apiSaveMemberAssignments(room, memberId, (item) =>
          getMemberClaim(item, memberId),
        )
        applyRoom(updated, 'member')
      })
    },
    setMemberItemClaim: (roomId, itemId, memberId, qty) => {
      if (!memberId) return
      const room = roomFromParam(roomId)
      const item = room?.items.find((i) => i.id === itemId)
      if (!item || !isAssignableKind(item.kind) || itemMemberQuantity(item) <= 0) return
      ensureMemberClaims(item)
      const current = getMemberClaim(item, memberId)
      const max = current + remainingMemberQty(item)
      const next = Math.min(max, Math.max(0, Math.floor(Number(qty) || 0)))
      if (next <= 0) delete item.memberClaims[memberId]
      else item.memberClaims[memberId] = next
      syncAssignedToFromClaims(item)
      normalizeItem(item)
      recalcAmounts(room)
      persist(room, 'member')
    },
    markPaid: async (roomId, memberId, proofFile = null) => {
      const room = roomFromParam(roomId)
      const member = room?.members.find((m) => m.id === memberId)
      if (!room || !member || !proofFile) return
      const userId = member.userId || memberId
      setPendingProofFile(room.id, proofFile)
      await withRoomError(roomId, async () => {
        const updated = await apiSubmitPaymentProof(room.id, userId)
        applyRoom(updated, 'member')
      })
      refreshDue(roomFromParam(roomId))
    },
    confirmPayment: async (roomId, memberId) => {
      const room = roomFromParam(roomId)
      const member = room?.members.find((m) => m.id === memberId)
      if (!member) return
      const userId = member.userId || (member.isHost ? room.hostUserId : memberId)
      if (!userId || member.isHost) return
      await withRoomError(roomId, async () => {
        const updated = await apiVerifyMemberPayment(room.id, userId)
        applyRoom(updated, 'host')
      })
      refreshDue(roomFromParam(roomId))
    },
    checkDueDate: (roomId) => {
      const room = roomFromParam(roomId)
      refreshDue(room)
      return room
    },
    completeRoom: async (roomId) => {
      await withRoomError(roomId, async () => {
        const cached = getRoomById(roomId)
        const apiId = cached?.id || (await resolveRoomIdForApi(roomId))
        const room = await apiFetchRoom(apiId, cached || state.rooms[apiId])
        applyRoom(room, 'host')
      })
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
    getMemberClaim,
    totalMemberClaims,
    remainingMemberQty,
    memberShareForItem,
    getMemberPayBreakdown,
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
  const { getRoom, ensureRoom } = useRoomState()
  const route = useRoute()
  const router = useRouter()
  const id = computed(() => unref(roomId))
  const room = computed(() => getRoom(id.value) || null)

  onMounted(() => {
    if (id.value && !getRoom(id.value)) ensureRoom(id.value)
  })
  watch(id, (v) => {
    if (v && !getRoom(v)) ensureRoom(v)
  })

  watch(
    room,
    (r) => {
      if (!r?.roomCode || !route.params.id || !route.name) return
      const slug = roomSlug(r)
      if (!isRoomCode(slug) || String(route.params.id).toUpperCase() === slug) return
      const target =
        hostPathForRouteName(r, route.name) || memberPathForRouteName(r, route.name)
      if (target && route.path !== target) router.replace(target)
    },
    { immediate: true },
  )

  return room
}

export function formatMYR(amount) {
  return `RM ${Number(amount).toFixed(2)}`
}
