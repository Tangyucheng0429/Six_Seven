export function inviteLink(roomId, inviteToken) {
  return `${window.location.origin}/join/${inviteToken}?room=${roomId}`
}

export async function shareInvite({ roomId, inviteToken, title = 'SixSeven bill' }) {
  const url = inviteLink(roomId, inviteToken)
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
  }
  await navigator.clipboard.writeText(url)
}
