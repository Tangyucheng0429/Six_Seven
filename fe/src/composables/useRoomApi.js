import { api } from '../api/client.js'
import {
  mapApiRoomToFe,
  buildVerifyReceiptPayload,
  hostItemIdsAfterVerify,
  menuItemsFromRoom,
  splitModeToApi,
  paymentTypeToApi,
} from './roomMapper.js'
import { readJson, ROOMS_KEY } from './useMyBills'

const pendingReceiptFiles = new Map()
const pendingQrFiles = new Map()
const pendingProofFiles = new Map()

function localMetaForRoom(roomId) {
  const saved = readJson(ROOMS_KEY, {})[roomId] || {}
  return {
    name: saved.name,
    billName: saved.name,
    hostName: saved.hostName,
    hostEmail: saved.hostEmail,
    dueDate: saved.dueDate,
    splitMode: saved.splitMode,
    splitConfirmed: saved.splitConfirmed,
    equalHeadcount: saved.equalHeadcount,
    equalHostParticipates: saved.equalHostParticipates,
    status: saved.status,
    receiptImageUrl: saved.receiptImageUrl,
  }
}

function payloadFromGetResponse(data) {
  return {
    room: data.room,
    host: data.host,
    receipt: data.receipt,
    items: data.items,
    assignments: data.assignments,
    participants: data.participants,
  }
}

export function setPendingReceiptFile(roomId, file) {
  if (file) pendingReceiptFiles.set(roomId, file)
  else pendingReceiptFiles.delete(roomId)
}

export function setPendingQrFile(roomId, file) {
  if (file) pendingQrFiles.set(roomId, file)
  else pendingQrFiles.delete(roomId)
}

export function setPendingProofFile(roomId, file) {
  if (file) pendingProofFiles.set(roomId, file)
  else pendingProofFiles.delete(roomId)
}

/** Move pending upload keyed by room code → canonical room UUID. */
export function migratePendingReceiptKey(fromKey, toKey) {
  if (!fromKey || !toKey || fromKey === toKey) return
  const file = pendingReceiptFiles.get(fromKey)
  if (!file) return
  pendingReceiptFiles.set(toKey, file)
  pendingReceiptFiles.delete(fromKey)
}

export async function apiCreateRoom({ name, hostName, hostEmail, dueDate }) {
  let due = new Date(`${dueDate}T23:59:59`)
  if (due <= new Date()) {
    due = new Date()
    due.setDate(due.getDate() + 1)
    due.setHours(23, 59, 59, 0)
  }

  const res = await api.createRoom({
    host_email: hostEmail,
    due_date: due.toISOString(),
    nickname: hostName,
  })

  const localMeta = {
    name,
    billName: name,
    hostName,
    hostEmail,
    dueDate,
    status: 'draft',
  }

  const full = await api.getRoom(res.room_id)
  return mapApiRoomToFe(payloadFromGetResponse(full), localMeta)
}

export async function apiFetchRoomByCode(roomCode, localMeta = {}) {
  const data = await api.getRoomByCode(roomCode)
  return mapApiRoomToFe(payloadFromGetResponse(data), localMeta)
}

export async function apiFetchRoom(roomId, existingRoom = null) {
  const localMeta = {
    ...localMetaForRoom(roomId),
    name: existingRoom?.name,
    hostName: existingRoom?.hostName,
    splitMode: existingRoom?.splitMode ?? localMetaForRoom(roomId).splitMode,
    splitConfirmed: existingRoom?.splitConfirmed ?? localMetaForRoom(roomId).splitConfirmed,
    equalHeadcount: existingRoom?.equalHeadcount ?? localMetaForRoom(roomId).equalHeadcount,
    equalHostParticipates:
      existingRoom?.equalHostParticipates ?? localMetaForRoom(roomId).equalHostParticipates,
    receiptImageUrl: existingRoom?.receiptImageUrl ?? localMetaForRoom(roomId).receiptImageUrl,
  }
  const data = await api.getRoom(roomId)
  return mapApiRoomToFe(payloadFromGetResponse(data), localMeta)
}

export async function apiJoinRoom(roomCode, nickname) {
  return api.joinRoom({
    room_code: roomCode,
    nickname,
  })
}

export async function apiUploadAndScan(apiRoomId) {
  const file = pendingReceiptFiles.get(apiRoomId)
  if (!file) throw new Error('No receipt image selected')
  await api.uploadReceipt(apiRoomId, file)
  pendingReceiptFiles.delete(apiRoomId)
  return apiFetchRoom(apiRoomId)
}

export async function apiVerifyReceipt(room) {
  const body = buildVerifyReceiptPayload(room)
  if (!body.receipt_id) throw new Error('Receipt not found')
  const menuItems = menuItemsFromRoom(room)
  const verifyRes = await api.verifyReceipt(body)

  if (room.splitMode === 'item' && room.hostUserId) {
    const ids = hostItemIdsAfterVerify(menuItems, verifyRes.items)
    await api.assignItems({
      room_id: room.id,
      user_id: room.hostUserId,
      selected_item_ids: ids,
    })
  }

  return apiFetchRoom(room.id, { ...room, splitConfirmed: true })
}

export async function apiPublishRoom(room, { type, notes, label }) {
  const qrFile = pendingQrFiles.get(room.id)
  await api.configSplit({
    roomId: room.id,
    splitMode: splitModeToApi(room.splitMode || 'equal'),
    paymentMethodType: paymentTypeToApi(type),
    paymentMethodDetail: notes || label || '',
    qrFile,
    equalHeadcount: room.equalHeadcount,
    equalHostParticipates: room.equalHostParticipates,
  })
  pendingQrFiles.delete(room.id)
  return apiFetchRoom(room.id, { ...room, status: 'open' })
}

export async function apiVerifyMemberPayment(roomId, memberUserId) {
  await api.verifyMemberPayment({
    room_id: roomId,
    member_user_id: memberUserId,
  })
  return apiFetchRoom(roomId)
}

export async function apiSaveMemberAssignments(room, memberId, getClaim) {
  const selected = room.items
    .filter((item) => (item.kind === 'food' || item.kind === 'drink') && getClaim(item) > 0)
    .map((item) => item.id)

  await api.assignItems({
    room_id: room.id,
    user_id: memberId,
    selected_item_ids: selected,
  })
  return apiFetchRoom(room.id, room)
}

export async function apiSubmitPaymentProof(apiRoomId, userId) {
  const file = pendingProofFiles.get(apiRoomId)
  if (!file) throw new Error('No payment proof selected')
  await api.submitProof({ roomId: apiRoomId, userId, file })
  pendingProofFiles.delete(apiRoomId)
  return apiFetchRoom(apiRoomId)
}
