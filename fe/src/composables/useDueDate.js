export function parseDueDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function isPastDue(dueDateIso) {
  const due = parseDueDate(dueDateIso)
  if (!due) return false
  const end = new Date(due)
  end.setHours(23, 59, 59, 999)
  return Date.now() > end.getTime()
}

export function formatDueDate(value) {
  const d = parseDueDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function unpaidTotal(room) {
  return (room?.members ?? [])
    .filter((m) => !m.isHost && !m.confirmed)
    .reduce((sum, m) => sum + (m.amountDue || 0), 0)
}

export function syncRoomDueState(room) {
  if (!room) return
  room.isOverdue = isPastDue(room.dueDate)
  if (room.isOverdue && unpaidTotal(room) > 0 && !room.overdueEmailSent) {
    room.overdueEmailSent = true
    room.overdueNotifiedAt = new Date().toISOString()
  }
}
