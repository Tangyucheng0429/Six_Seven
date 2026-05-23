import { onMounted, watch, unref } from 'vue'
import { useRouter } from 'vue-router'
import { getRoomById } from './useRoomState'
import { isHostOfRoom } from './useHostCookie'
/** Restore member id after refresh from saved access list. */
export function useRestoreMemberSession(roomId, { state, getMyAccessList }) {
  function restore() {
    if (state.currentMemberId) return state.currentMemberId
    const id = unref(roomId)
    if (!id) return null
    const uuid = getRoomById(id)?.id || id
    const entry = getMyAccessList().find(
      (a) => a.roomId === uuid && a.role === 'member' && a.memberId,
    )
    if (entry?.memberId) {
      const room = getRoomById(id)
      if (room && isHostOfRoom(room, entry.memberId)) {
        state.currentMemberId = null
        return null
      }
      state.currentMemberId = entry.memberId
      return entry.memberId
    }
    return null
  }

  onMounted(restore)
  watch(() => unref(roomId), restore)

  return { restore }
}

/** After room loads, send guests without a session back to join by room code. */
export function useRequireMemberSession(roomId, { state, getMyAccessList, enabled = true }) {
  const router = useRouter()
  const { restore } = useRestoreMemberSession(roomId, { state, getMyAccessList })

  function redirectIfNeeded() {
    if (!enabled) return
    const id = unref(roomId)
    if (!id || state.currentMemberId) return
    const room = getRoomById(id)
    const code = room?.roomCode || room?.inviteToken
    if (code) router.replace(`/join/${code}`)
  }

  onMounted(() => {
    restore()
    redirectIfNeeded()
  })

  watch(
    () => [unref(roomId), state.currentMemberId],
    () => redirectIfNeeded(),
  )

  return { restore }
}
