import { createMockReceiptItems } from './parseReceiptMock'

export { createMockReceiptItems }

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
    taxFromScan: false,
    scannedSstRate: 0.06,
    scannedServiceRate: 0.1,
    taxEnabled: false,
    taxRate: 0.06,
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
    taxFromScan: true,
    scannedSstRate: 0.06,
    scannedServiceRate: 0.1,
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
