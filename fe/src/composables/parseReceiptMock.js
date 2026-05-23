/** Mock AI OCR: line items + per-item SST + service charge from receipt. */

const MOCK_SST_RATE = 0.06
const MOCK_SERVICE_RATE = 0.1

export function mockScanTaxMeta() {
  return {
    taxFromScan: true,
    scannedSstRate: MOCK_SST_RATE,
    scannedServiceRate: MOCK_SERVICE_RATE,
    taxEnabled: false,
    taxRate: MOCK_SST_RATE,
  }
}

export function createMockReceiptItems() {
  const menu = [
    {
      id: '1',
      name: 'Chicken Rice',
      kind: 'food',
      unitPrice: 12.5,
      quantity: 1,
      taxRate: MOCK_SST_RATE,
      taxFromScan: true,
      hostQuantity: 0,
      assignedTo: [],
    },
    {
      id: '2',
      name: 'Teh Tarik',
      kind: 'drink',
      unitPrice: 3.5,
      quantity: 2,
      taxRate: MOCK_SST_RATE,
      taxFromScan: true,
      hostQuantity: 0,
      assignedTo: [],
    },
    {
      id: '3',
      name: 'Char Kuey Teow',
      kind: 'food',
      unitPrice: 14.0,
      quantity: 1,
      taxRate: MOCK_SST_RATE,
      taxFromScan: true,
      hostQuantity: 0,
      assignedTo: [],
    },
  ]

  const menuBase = menu.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const serviceCharge = Math.round(menuBase * MOCK_SERVICE_RATE * 100) / 100

  return [
    ...menu,
    {
      id: 'fee-sc',
      name: `Service charge (${MOCK_SERVICE_RATE * 100}%)`,
      kind: 'fee',
      feeRole: 'serviceCharge',
      unitPrice: serviceCharge,
      quantity: 1,
      taxRate: 0,
      taxFromScan: true,
      hostQuantity: 0,
      assignedTo: [],
    },
  ]
}
