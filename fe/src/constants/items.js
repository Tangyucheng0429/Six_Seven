export const ITEM_KINDS = [
  { value: 'food', label: 'Food' },
  { value: 'drink', label: 'Drink' },
  { value: 'fee', label: 'Fee / charge' },
  { value: 'tax', label: 'Tax line' },
  { value: 'other', label: 'Other' },
]

export function isFeeLikeKind(kind) {
  return kind === 'fee' || kind === 'tax'
}

export function isAssignableKind(kind) {
  return !isFeeLikeKind(kind)
}

export const ITEM_KIND_LABELS = Object.fromEntries(
  ITEM_KINDS.map((k) => [k.value, k.label]),
)
