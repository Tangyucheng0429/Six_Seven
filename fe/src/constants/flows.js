export const HOST_STEPS = [
  'Create',
  'Upload',
  'OCR',
  'Split mode',
  'Verify',
  'Payment',
  'Invite',
]

export const MEMBER_STEPS = ['Join', 'Assign', 'Pay', 'Done']

export function hostStepIndex(status) {
  const map = {
    draft: 0,
    uploaded: 1,
    scanning: 2,
    split_mode: 3,
    review: 4,
    payment_setup: 5,
    open: 6,
    overdue: 6,
    completed: 6,
  }
  return map[status] ?? 0
}

export function memberStepIndex({ splitMode, paid, confirmed }) {
  if (confirmed) return 3
  if (paid) return 3
  if (splitMode === 'equal') return 2
  return 1
}
