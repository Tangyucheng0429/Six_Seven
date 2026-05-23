import { copyToClipboard } from '../utils/copyToClipboard.js'

export function inviteLink(roomCode) {
  const code = String(roomCode || '').trim().toUpperCase()
  return `${window.location.origin}/join/${code}`
}

export async function shareInvite({ roomCode, title = 'SixSeven bill' }) {
  const url = inviteLink(roomCode)
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
  }
  await copyToClipboard(url)
}
