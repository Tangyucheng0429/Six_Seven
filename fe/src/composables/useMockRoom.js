export function createMockReceiptItems() {
  return [
    { id: '1', name: 'Chicken Rice', price: 12.5, assignedTo: [] },
    { id: '2', name: 'Teh Tarik', price: 3.5, assignedTo: [] },
    { id: '3', name: 'Char Kuey Teow', price: 14.0, assignedTo: [] },
    { id: '4', name: 'Service Charge', price: 2.0, assignedTo: [] },
  ]
}

export function createEmptyRoom({ id, name, hostName, hostEmail, dueDate }) {
  return {
    id,
    name,
    hostName,
    hostEmail: hostEmail || '',
    dueDate: dueDate || '',
    hostToken: `host-${id}`,
    inviteToken: `join-${id}`,
    splitMode: null,
    status: 'draft',
    receiptImageUrl: null,
    items: [],
    members: [
      {
        id: 'host',
        name: hostName,
        isHost: true,
        amountDue: 0,
        paid: false,
        confirmed: false,
        proofUrl: null,
      },
    ],
    paymentMethod: { type: 'duitnow', label: 'DuitNow QR', imageUrl: null, notes: '' },
    isOverdue: false,
    overdueEmailSent: false,
    overdueNotifiedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  }
}

export function createDemoRoom() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dueDate = yesterday.toISOString().slice(0, 10)

  const id = 'demo01'
  return {
    ...createEmptyRoom({
      id,
      name: 'Friday Lunch',
      hostName: 'Jeff',
      hostEmail: 'jeff@example.com',
      dueDate,
    }),
    status: 'open',
    splitMode: 'item',
    items: createMockReceiptItems(),
    members: [
      { id: 'host', name: 'Jeff', isHost: true, amountDue: 0, paid: true, confirmed: true, proofUrl: null },
      { id: 'm2', name: 'Ali', isHost: false, amountDue: 15.5, paid: true, confirmed: false, proofUrl: null },
      { id: 'm3', name: 'Siti', isHost: false, amountDue: 17.5, paid: false, confirmed: false, proofUrl: null },
    ],
    paymentMethod: {
      type: 'duitnow',
      label: 'DuitNow QR',
      imageUrl: null,
      notes: 'Transfer to Jeff — ref: FRIDAY',
    },
    isOverdue: true,
    overdueEmailSent: false,
  }
}
