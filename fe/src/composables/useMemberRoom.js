import { computed, onMounted, onUnmounted, unref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomState } from './useRoomState'
import { isRoomCode } from './roomCodes'
import { memberPathForRouteName, roomSlug } from './roomPaths'

/** Member views: always refresh from API and optionally poll payment status. */
export function useMemberRoom(roomId, { pollMs = 0 } = {}) {
  const { getRoom, fetchRoom } = useRoomState()
  const route = useRoute()
  const router = useRouter()
  const id = computed(() => unref(roomId))
  const room = computed(() => getRoom(id.value) || null)
  let timer = null

  async function refresh() {
    if (!id.value) return null
    return fetchRoom(id.value, { role: 'member' })
  }

  onMounted(() => {
    refresh()
    if (pollMs > 0) {
      timer = setInterval(() => refresh(), pollMs)
    }
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  watch(
    room,
    (r) => {
      if (!r?.roomCode || !route.params.id || !route.name) return
      const slug = roomSlug(r)
      if (!isRoomCode(slug) || String(route.params.id).toUpperCase() === slug) return
      const target = memberPathForRouteName(r, route.name)
      if (target && route.path !== target) router.replace(target)
    },
    { immediate: true },
  )

  return { room, refresh }
}
