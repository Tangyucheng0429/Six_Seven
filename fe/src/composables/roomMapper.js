import { syncRoomDueState } from './useDueDate'

const PAYMENT_FE_TO_BE = {
  duitnow: 'DUITNOW_QR',
  tng: 'TNG_QR',
  bank: 'BANK_TRANSFER',
}

const PAYMENT_BE_TO_FE = {
  DUITNOW_QR: 'duitnow',
  TNG_QR: 'tng',
  BANK_TRANSFER: 'bank',
}

export function splitModeToApi(mode) {
  return mode === 'equal' ? 'EQUAL' : 'ITEM_BASED'
}

export function splitModeFromApi(mode) {
  return mode === 'EQUAL' ? 'equal' : 'item'
}

export function paymentTypeToApi(type) {
  return PAYMENT_FE_TO_BE[type] || 'DUITNOW_QR'
}

function paymentLabel(type) {
  const map = {
    duitnow: 'DuitNow QR',
    tng: "Touch 'n Go",
    bank: 'Bank transfer',
  }
  return map[type] || type
}

function inferSetupStatus(roomRow, receipt, localMeta = {}) {
  if (roomRow.status === 'COMPLETED') return 'completed'

  const localStatus = localMeta.status

  if (!receipt) {
    if (localStatus && ['uploaded', 'scanning'].includes(localStatus)) {
      return localStatus
    }
    return localStatus || 'draft'
  }

  if (!receipt.is_verified) {
    if (localMeta.splitConfirmed || localStatus === 'review') return 'review'
    return 'split_mode'
  }

  // Receipt verified on server — trust DB for publish state (ignore stale localStorage step)
  if (roomRow.payment_method_type) return 'open'

  return 'payment_setup'
}

function taxRatesFromReceipt(receipt) {
  const subtotal = Number(receipt?.subtotal) || 0
  const tax = Number(receipt?.tax_amount) || 0
  const service = Number(receipt?.service_charge) || 0
  return {
    scannedSstRate: subtotal > 0 ? tax / subtotal : 0.06,
    scannedServiceRate: subtotal > 0 ? service / subtotal : 0.1,
    taxFromScan: tax > 0 || service > 0,
  }
}

function mapItems(receiptItems, assignmentByItem, hostUserId, receipt, taxMeta) {
  const items = (receiptItems || []).map((row) => {
    const assignees = assignmentByItem[row.item_id] || []
    const qty = Math.max(1, Number(row.quantity) || 1)
    const hostAssigned = hostUserId && assignees.includes(hostUserId)
    const memberAssignees = assignees.filter((id) => id !== hostUserId)
    return {
      id: row.item_id,
      name: row.item_name,
      kind: 'food',
      unitPrice: Number(row.price) || 0,
      quantity: qty,
      taxRate: taxMeta.scannedSstRate,
      taxFromScan: taxMeta.taxFromScan,
      hostQuantity: hostAssigned ? qty : 0,
      assignedTo: memberAssignees,
      memberClaims: {},
      price: 0,
    }
  })

  const taxAmount = Number(receipt?.tax_amount) || 0
  const serviceCharge = Number(receipt?.service_charge) || 0

  if (taxAmount > 0.01) {
    items.push({
      id: 'fee-tax',
      name: 'SST',
      kind: 'tax',
      unitPrice: Math.round(taxAmount * 100) / 100,
      quantity: 1,
      taxRate: 0,
      taxFromScan: true,
      hostQuantity: 0,
      assignedTo: [],
      memberClaims: {},
      price: 0,
    })
  }

  if (serviceCharge > 0.01) {
    items.push({
      id: 'fee-sc',
      name: `Service charge (${Math.round(taxMeta.scannedServiceRate * 1000) / 10}%)`,
      kind: 'fee',
      feeRole: 'serviceCharge',
      unitPrice: Math.round(serviceCharge * 100) / 100,
      quantity: 1,
      taxRate: 0,
      taxFromScan: true,
      hostQuantity: 0,
      assignedTo: [],
      memberClaims: {},
      price: 0,
    })
  }

  return items
}

/** Hydrate qty stepper state from item_assignments (GET room). */
function syncMemberClaimsFromAssignments(items, assignmentByItem, hostUserId) {
  for (const item of items) {
    if (item.kind !== 'food' && item.kind !== 'drink') continue
    const qty = Math.max(1, Number(item.quantity) || 1)
    const hostQty = Math.max(0, Number(item.hostQuantity) || 0)
    const pool = Math.max(0, qty - hostQty)
    item.memberClaims = {}
    if (pool <= 0) continue

    const assignees = (assignmentByItem[item.id] || []).filter((uid) => uid !== hostUserId)
    if (!assignees.length) continue

    if (assignees.length === 1) {
      item.memberClaims[assignees[0]] = pool
      continue
    }

    let remaining = pool
    assignees.forEach((uid, index) => {
      const share =
        index === assignees.length - 1
          ? remaining
          : Math.floor(pool / assignees.length)
      item.memberClaims[uid] = share
      remaining -= share
    })
  }
}

function mapMembers(participants, hostUserId, hostNickname) {
  const members = (participants || []).map((p) => {
    const isHost = p.user_id === hostUserId
    const status = p.payment_status
    return {
      id: p.user_id,
      userId: p.user_id,
      name: p.nickname || (isHost ? hostNickname || 'Host' : 'Member'),
      isHost,
      amountDue: Number(p.amount_to_pay) || 0,
      paid: status === 'PAID' || status === 'VERIFIED',
      confirmed: status === 'VERIFIED',
      proofUrl: p.proof_image_url || null,
    }
  })

  if (hostUserId && !members.some((m) => m.isHost)) {
    members.unshift({
      id: hostUserId,
      userId: hostUserId,
      name: hostNickname || 'Host',
      isHost: true,
      amountDue: 0,
      paid: true,
      confirmed: true,
      proofUrl: null,
    })
  }

  return members
}

/** Map GET /api/rooms/:id payload into the frontend room model. */
export function mapApiRoomToFe(payload, localMeta = {}) {
  const roomRow = payload.room
  const receipt = payload.receipt
  const taxMeta = receipt ? taxRatesFromReceipt(receipt) : {
    scannedSstRate: 0.06,
    scannedServiceRate: 0.1,
    taxFromScan: false,
  }

  const assignmentByItem = {}
  for (const row of payload.assignments || []) {
    if (!assignmentByItem[row.item_id]) assignmentByItem[row.item_id] = []
    assignmentByItem[row.item_id].push(row.user_id)
  }

  const payType = PAYMENT_BE_TO_FE[roomRow.payment_method_type] || 'duitnow'
  const status = inferSetupStatus(roomRow, receipt, localMeta)

  const room = {
    id: roomRow.room_id,
    roomCode: roomRow.room_code,
    name: localMeta.name || localMeta.billName || `Bill ${roomRow.room_code}`,
    hostName: payload.host?.nickname || localMeta.hostName || 'Host',
    hostEmail: roomRow.host_email,
    hostUserId: roomRow.host_id,
    dueDate: roomRow.due_date?.slice?.(0, 10) || roomRow.due_date,
    hostToken: `host-${roomRow.room_id}`,
    inviteToken: roomRow.room_code,
    receiptId: receipt?.receipt_id || null,
    splitMode: localMeta.splitMode || splitModeFromApi(roomRow.split_mode),
    status,
    receiptImageUrl: receipt?.image_url || localMeta.receiptImageUrl || null,
    items: (() => {
      if (!receipt) return []
      const mapped = mapItems(
        payload.items,
        assignmentByItem,
        roomRow.host_id,
        receipt,
        taxMeta,
      )
      syncMemberClaimsFromAssignments(mapped, assignmentByItem, roomRow.host_id)
      return mapped
    })(),
    members: mapMembers(payload.participants, roomRow.host_id, payload.host?.nickname),
    ...taxMeta,
    taxEnabled: taxMeta.taxFromScan,
    taxRate: taxMeta.scannedSstRate,
    paymentMethod: {
      type: payType,
      label: paymentLabel(payType),
      imageUrl: roomRow.qr_code_url || null,
      notes: roomRow.payment_method_detail || '',
    },
    isOverdue: false,
    overdueEmailSent: false,
    overdueNotifiedAt: null,
    completedAt: roomRow.status === 'COMPLETED' ? new Date().toISOString() : null,
    createdAt: roomRow.created_at || new Date().toISOString(),
    dbStatus: roomRow.status,
    equalHeadcount: localMeta.equalHeadcount ?? 2,
    equalHostParticipates: localMeta.equalHostParticipates ?? true,
  }

  syncRoomDueState(room)
  if (room.isOverdue && room.status === 'open') room.status = 'overdue'

  return room
}

export function buildVerifyReceiptPayload(room) {
  const menuItems = room.items.filter((i) => i.kind === 'food' || i.kind === 'drink')
  const feeItems = room.items.filter((i) => i.kind === 'fee' || i.kind === 'tax')

  let subtotal = menuItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  let taxAmount = menuItems.reduce((s, i) => s + i.unitPrice * i.quantity * (i.taxRate || 0), 0)
  let serviceCharge = feeItems
    .filter((i) => i.feeRole === 'serviceCharge' || /service/i.test(i.name))
    .reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  const extraTax = feeItems
    .filter((i) => i.kind === 'tax')
    .reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  taxAmount += extraTax

  const totalAmount = Math.round((subtotal + taxAmount + serviceCharge) * 100) / 100
  subtotal = Math.round(subtotal * 100) / 100
  taxAmount = Math.round(taxAmount * 100) / 100
  serviceCharge = Math.round(serviceCharge * 100) / 100

  return {
    receipt_id: room.receiptId,
    subtotal,
    tax_amount: taxAmount,
    service_charge: serviceCharge,
    total_amount: totalAmount,
    items: menuItems.map((i) => ({
      item_name: i.name,
      price: i.unitPrice,
      quantity: i.quantity,
    })),
  }
}

export function hostItemIdsForAssign(room) {
  return room.items
    .filter((i) => (i.kind === 'food' || i.kind === 'drink') && (i.hostQuantity || 0) > 0)
    .map((i) => i.id)
}

/** After verify replaces item rows, map host picks from menu line index → new item_id. */
export function hostItemIdsAfterVerify(menuItems, insertedItems) {
  if (!insertedItems?.length) return []
  return insertedItems
    .map((row, index) => {
      const src = menuItems[index]
      if (!src || (src.hostQuantity || 0) <= 0) return null
      return row.item_id
    })
    .filter(Boolean)
}

export function menuItemsFromRoom(room) {
  return (room?.items || []).filter((i) => i.kind === 'food' || i.kind === 'drink')
}
